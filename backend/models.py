"""
Pydantic models (request/response schemas) for the ZYVON backend.
These are NOT Firestore documents — they are API contract shapes.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, HttpUrl


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    admin = "admin"
    customer = "customer"


class PaymentType(str, Enum):
    online = "online"
    cod = "cod"


class PaymentStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    delivered = "delivered"
    failed = "failed"
    refunded = "refunded"


class RefundStatus(str, Enum):
    initiated = "initiated"
    completed = "completed"
    failed = "failed"


class OrderStatus(str, Enum):
    active_online = "active_online"
    active_cod = "active_cod"
    completed = "completed"
    canceled = "canceled"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class ReviewPendingItem(BaseModel):
    productId: str
    name: str
    imageUrl: str

class ReviewPending(BaseModel):
    products: list[ReviewPendingItem]

class UserOut(BaseModel):
    uid: str
    email: EmailStr
    role: UserRole
    created_at: Optional[datetime] = None
    reviewPending: Optional[ReviewPending] = None
    reviewedProductIds: list[str] = []


# ---------------------------------------------------------------------------
# Address
# ---------------------------------------------------------------------------

class AddressIn(BaseModel):
    label: str = Field(..., description="e.g. Home, Work, Hostel")
    line1: str
    line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    phone: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class AddressOut(AddressIn):
    address_id: str


# ---------------------------------------------------------------------------
# Cart
# ---------------------------------------------------------------------------

class CartItemIn(BaseModel):
    product_id: str
    name: str
    size: str = Field(..., description="S | M | L | XL")
    quantity: int = Field(..., ge=1)
    price: float = Field(..., gt=0)
    imageUrl: Optional[str] = None


class CartItemOut(CartItemIn):
    cart_item_id: str
    added_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Product sizes
# ---------------------------------------------------------------------------

class SizeStock(BaseModel):
    price: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)


class ProductSizes(BaseModel):
    S: Optional[SizeStock] = None
    M: Optional[SizeStock] = None
    L: Optional[SizeStock] = None
    XL: Optional[SizeStock] = None


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductIn(BaseModel):
    type: str
    name: str
    description: str
    tagline: Optional[str] = ""
    sizes: ProductSizes
    active: bool = True


class ProductOut(ProductIn):
    product_id: str
    images: list[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Order line item
# ---------------------------------------------------------------------------

class OrderProduct(BaseModel):
    product_id: str
    size: str
    quantity: int = Field(..., ge=1)
    price: float = Field(..., gt=0)


# ---------------------------------------------------------------------------
# Refund details
# ---------------------------------------------------------------------------

class RefundDetails(BaseModel):
    refund_status: RefundStatus
    refund_amount: float
    refund_id: str


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

class OrderIn(BaseModel):
    payment_type: PaymentType
    address_id: str  # reference to saved address


class OrderOut(BaseModel):
    order_id: str
    user_id: str
    products: list[OrderProduct]
    total_amount: float
    platform_charge: float
    grand_total: float
    currency: str = "INR"
    payment_type: PaymentType
    payment_status: PaymentStatus
    stripe_session_id: Optional[str] = None
    cancellation_deadline: Optional[datetime] = None
    refund_details: Optional[RefundDetails] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Checkout session
# ---------------------------------------------------------------------------

class RazorpayCheckoutOut(BaseModel):
    razorpay_order_id: str
    order_id: str
    amount: int
    currency: str
    
class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str


# ---------------------------------------------------------------------------
# COD order
# ---------------------------------------------------------------------------

class CODOrderOut(BaseModel):
    order_id: str
    message: str = "COD order placed successfully"
    grand_total: float


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class GoogleAuthCallbackIn(BaseModel):
    code: str  # OAuth authorization code from Google


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    uid: str
    email: str
    role: UserRole


# ---------------------------------------------------------------------------
# Admin: Update order status
# ---------------------------------------------------------------------------

class AdminOrderStatusUpdate(BaseModel):
    new_status: OrderStatus


# ---------------------------------------------------------------------------
# Refund request (user-initiated within 24 hrs)
# ---------------------------------------------------------------------------

class CancelOrderOut(BaseModel):
    order_id: str
    refund_id: Optional[str] = None
    message: str


# ---------------------------------------------------------------------------
# Generic responses
# ---------------------------------------------------------------------------

class MessageOut(BaseModel):
    message: str


class ErrorOut(BaseModel):
    detail: str


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Star rating 1–5")
    text: str = Field("", min_length=0, max_length=280, description="Review text (max 280 chars, optional)")


class ReviewItem(BaseModel):
    userId: str
    rating: int
    text: str
    createdAt: Optional[datetime] = None


class ReviewsOut(BaseModel):
    count: int = 0
    list: List[ReviewItem] = []


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

class CategoryIn(BaseModel):
    name: str = Field(..., description="Display name of the category")
    slug: Optional[str] = Field(None, description="URL-friendly slug (auto-generated if omitted)")
    thumbnail: str = Field(..., description="Cloudinary image URL for the category thumbnail")
    parentId: Optional[str] = Field(None, description="Parent category ID; null if top-level")
    children: list[str] = Field(default_factory=list, description="List of child category IDs")
    products: list[str] = Field(default_factory=list, description="List of product IDs at this leaf level")

class CategoryOut(CategoryIn):
    categoryId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
