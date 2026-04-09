import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{DATA_DIR / 'app.db'}",
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_order_map_columns() -> None:
    """Add map columns to SQLite `orders` if missing (non-destructive for existing DBs)."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    defaults = {
        "dlat": 18.489,
        "dlng": 73.892,
        "rlat": 18.468,
        "rlng": 73.868,
    }
    with engine.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(orders)")).fetchall()
        col_names = {r[1] for r in rows}
        alters = []
        for name, ddl in (
            ("destination_lat", "REAL"),
            ("destination_lng", "REAL"),
            ("rider_lat", "REAL"),
            ("rider_lng", "REAL"),
        ):
            if name not in col_names:
                alters.append(f"ALTER TABLE orders ADD COLUMN {name} {ddl}")
        for stmt in alters:
            conn.execute(text(stmt))
        if alters:
            conn.execute(
                text(
                    "UPDATE orders SET destination_lat = :dlat, destination_lng = :dlng, "
                    "rider_lat = COALESCE(rider_lat, :rlat), rider_lng = COALESCE(rider_lng, :rlng) "
                    "WHERE destination_lat IS NULL"
                ),
                defaults,
            )
        conn.commit()
