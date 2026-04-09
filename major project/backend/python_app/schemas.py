from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

OrderStatus = Literal["pending", "failed", "complete"]


class ItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class ItemRead(BaseModel):
    id: int
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    reference: str = Field(..., min_length=1, max_length=255)
    status: OrderStatus = "pending"
    destination_lat: float | None = Field(None, ge=-90, le=90)
    destination_lng: float | None = Field(None, ge=-180, le=180)
    rider_lat: float | None = Field(None, ge=-90, le=90)
    rider_lng: float | None = Field(None, ge=-180, le=180)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus | None = None
    rider_lat: float | None = Field(None, ge=-90, le=90)
    rider_lng: float | None = Field(None, ge=-180, le=180)

    @model_validator(mode="after")
    def require_some_update(self):
        if self.status is None and self.rider_lat is None and self.rider_lng is None:
            raise ValueError("provide status and/or rider coordinates")
        rl, rln = self.rider_lat, self.rider_lng
        if (rl is None) ^ (rln is None):
            raise ValueError("rider_lat and rider_lng must be set together")
        return self


class OrderRead(BaseModel):
    id: int
    reference: str
    status: str
    created_at: datetime
    updated_at: datetime | None
    destination_lat: float | None = None
    destination_lng: float | None = None
    rider_lat: float | None = None
    rider_lng: float | None = None

    model_config = {"from_attributes": True}


class OrderSummary(BaseModel):
    pending: int
    failed: int
    complete: int
    total: int


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    phone: str | None = Field(None, max_length=64)
    address: str | None = Field(None, max_length=512)
    password: str = Field(..., min_length=1, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class AuthOkResponse(BaseModel):
    ok: bool = True
    email: str
    full_name: str
