import hashlib
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import Base, engine, ensure_order_map_columns, get_db
from models import Customer, Item, Order
from schemas import (
    AuthOkResponse,
    ItemCreate,
    ItemRead,
    LoginRequest,
    OrderCreate,
    OrderRead,
    OrderStatusUpdate,
    OrderSummary,
    RegisterRequest,
)


def _hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

NODE_URL = os.environ.get("NODE_SERVICE_URL", "http://127.0.0.1:3001")
GO_URL = os.environ.get("GO_SERVICE_URL", "http://127.0.0.1:8082")

# Demo map coordinates (Pune — destination vs rider offset) when none supplied on create
DEFAULT_DEST_LAT = 18.489
DEFAULT_DEST_LNG = 73.892
DEFAULT_RIDER_LAT = 18.468
DEFAULT_RIDER_LNG = 73.868


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_order_map_columns()
    yield


app = FastAPI(title="Multi-lang backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "python"}


@app.get("/api/items", response_model=list[ItemRead])
def list_items(db: Session = Depends(get_db), skip: int = 0, limit: int = 50):
    rows = db.scalars(select(Item).offset(skip).limit(limit)).all()
    return rows


@app.post("/api/items", response_model=ItemRead, status_code=201)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    item = Item(title=payload.title.strip())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/items/count")
def items_count(db: Session = Depends(get_db)):
    n = db.scalar(select(func.count()).select_from(Item)) or 0
    return {"count": n}


@app.get("/api/orders/summary", response_model=OrderSummary)
def orders_summary(db: Session = Depends(get_db)):
    pending = (
        db.scalar(
            select(func.count()).select_from(Order).where(Order.status == "pending")
        )
        or 0
    )
    failed = (
        db.scalar(
            select(func.count()).select_from(Order).where(Order.status == "failed")
        )
        or 0
    )
    complete = (
        db.scalar(
            select(func.count()).select_from(Order).where(Order.status == "complete")
        )
        or 0
    )
    total = db.scalar(select(func.count()).select_from(Order)) or 0
    return OrderSummary(
        pending=pending, failed=failed, complete=complete, total=total
    )


@app.get("/api/orders", response_model=list[OrderRead])
def list_orders(
    db: Session = Depends(get_db),
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    q = select(Order)
    if status is not None:
        if status not in ("pending", "failed", "complete"):
            raise HTTPException(status_code=400, detail="invalid status filter")
        q = q.where(Order.status == status)
    q = q.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(q).all())


@app.post("/api/orders", response_model=OrderRead, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    dlat = (
        payload.destination_lat
        if payload.destination_lat is not None
        else DEFAULT_DEST_LAT
    )
    dlng = (
        payload.destination_lng
        if payload.destination_lng is not None
        else DEFAULT_DEST_LNG
    )
    rlat = payload.rider_lat if payload.rider_lat is not None else DEFAULT_RIDER_LAT
    rlng = payload.rider_lng if payload.rider_lng is not None else DEFAULT_RIDER_LNG
    order = Order(
        reference=payload.reference.strip(),
        status=payload.status,
        destination_lat=dlat,
        destination_lng=dlng,
        rider_lat=rlat,
        rider_lng=rlng,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.patch("/api/orders/{order_id}", response_model=OrderRead)
def update_order_status(
    order_id: int, payload: OrderStatusUpdate, db: Session = Depends(get_db)
):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="order not found")
    if payload.status is not None:
        order.status = payload.status
        if payload.status == "complete":
            if order.destination_lat is not None and order.destination_lng is not None:
                order.rider_lat = order.destination_lat
                order.rider_lng = order.destination_lng
    if payload.rider_lat is not None and payload.rider_lng is not None:
        order.rider_lat = payload.rider_lat
        order.rider_lng = payload.rider_lng
    db.commit()
    db.refresh(order)
    return order


@app.get("/api/tracking/{reference}", response_model=OrderRead)
def track_by_reference(reference: str, db: Session = Depends(get_db)):
    ref = reference.strip()
    if not ref:
        raise HTTPException(status_code=400, detail="empty reference")
    order = db.scalar(
        select(Order).where(func.lower(Order.reference) == ref.lower())
    )
    if order is None:
        raise HTTPException(status_code=404, detail="tracking id not found")
    return order


@app.post("/api/auth/register", response_model=AuthOkResponse, status_code=201)
def auth_register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.scalar(select(Customer).where(Customer.email == email)):
        raise HTTPException(status_code=400, detail="email already registered")
    customer = Customer(
        full_name=payload.full_name.strip(),
        email=email,
        phone=(payload.phone or "").strip() or None,
        address=(payload.address or "").strip() or None,
        password_hash=_hash_password(payload.password),
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return AuthOkResponse(email=customer.email, full_name=customer.full_name)


@app.post("/api/auth/login", response_model=AuthOkResponse)
def auth_login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    customer = db.scalar(select(Customer).where(Customer.email == email))
    if customer is None or customer.password_hash != _hash_password(payload.password):
        raise HTTPException(status_code=401, detail="invalid email or password")
    return AuthOkResponse(email=customer.email, full_name=customer.full_name)


@app.get("/api/stack/status")
async def stack_status():
    """Checks Node and Go satellite services (optional)."""
    out = {"python": {"ok": True}, "node": None, "go": None}
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            r = await client.get(f"{NODE_URL}/health")
            out["node"] = {"ok": r.status_code == 200, "body": r.json()}
        except Exception as e:
            out["node"] = {"ok": False, "error": str(e)}
        try:
            r = await client.get(f"{GO_URL}/health")
            out["go"] = {"ok": r.status_code == 200, "body": r.json()}
        except Exception as e:
            out["go"] = {"ok": False, "error": str(e)}
    return out


_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if (_PROJECT_ROOT / "index.html").is_file():
    app.mount(
        "/",
        StaticFiles(directory=str(_PROJECT_ROOT), html=True),
        name="site",
    )
