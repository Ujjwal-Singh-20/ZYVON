"""
Cart router — per-user cart stored at /users/{uid}/cart/{cartItemId}.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_client import get_db
from dependencies import get_current_user
from models import CartItemIn, CartItemOut, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cart", tags=["cart"])


def _cart_collection(uid: str):
    db = get_db()
    return db.collection("users").document(uid).collection("cart")


# ---------------------------------------------------------------------------
# List cart
# ---------------------------------------------------------------------------
@router.get("", response_model=list[CartItemOut], summary="Get current user's cart")
def get_cart(current_user: dict = Depends(get_current_user)):
    uid = current_user["uid"]
    docs = _cart_collection(uid).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        results.append(
            CartItemOut(
                cart_item_id=doc.id,
                product_id=data["productId"],
                name=data["name"],
                size=data["size"],
                quantity=data["quantity"],
                price=data["price"],
                added_at=data.get("addedAt"),
                imageUrl=data.get("imageUrl", ""),
            )
        )
    return results


# ---------------------------------------------------------------------------
# Add item
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=CartItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add item to cart",
)
def add_to_cart(
    body: CartItemIn,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]

    # Validate product + stock
    db = get_db()
    prod_doc = db.collection("products").document(body.product_id).get()
    if not prod_doc.exists or not prod_doc.to_dict().get("active", True):
        raise HTTPException(status_code=404, detail="Product not found or inactive")

    sizes = prod_doc.to_dict().get("sizes", {})
    size_data = sizes.get(body.size)
    if not size_data:
        raise HTTPException(status_code=400, detail=f"Size {body.size} not available")
    if size_data.get("stock", 0) < body.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for size {body.size}. Available: {size_data['stock']}",
        )

    cart_item_id = str(uuid.uuid4())
    payload = {
        "productId": body.product_id,
        "name": body.name,
        "size": body.size,
        "quantity": body.quantity,
        "price": body.price,
        "imageUrl": body.imageUrl,
        "addedAt": SERVER_TIMESTAMP,
    }
    _cart_collection(uid).document(cart_item_id).set(payload)
    logger.info(f"Cart item {cart_item_id} added for user {uid}")

    return CartItemOut(cart_item_id=cart_item_id, **body.model_dump())


# ---------------------------------------------------------------------------
# Update quantity
# ---------------------------------------------------------------------------
@router.patch(
    "/{cart_item_id}",
    response_model=CartItemOut,
    summary="Update quantity of a cart item",
)
def update_cart_item(
    cart_item_id: str,
    quantity: int,
    current_user: dict = Depends(get_current_user),
):
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    uid = current_user["uid"]
    db = get_db()
    ref = _cart_collection(uid).document(cart_item_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Cart item not found")

    data = doc.to_dict()

    # Validate against live stock
    prod_doc = db.collection("products").document(data["productId"]).get()
    if prod_doc.exists:
        sizes = prod_doc.to_dict().get("sizes", {})
        size_data = sizes.get(data["size"], {})
        available = size_data.get("stock", 0)
        if quantity > available:
            raise HTTPException(
                status_code=400,
                detail=f"Only {available} unit(s) available for size {data['size']}",
            )

    ref.update({"quantity": quantity})
    return CartItemOut(
        cart_item_id=cart_item_id,
        product_id=data["productId"],
        name=data["name"],
        size=data["size"],
        quantity=quantity,
        price=data["price"],
        added_at=data.get("addedAt"),
        imageUrl=data.get("imageUrl", ""),
    )


# ---------------------------------------------------------------------------
# Remove item
# ---------------------------------------------------------------------------
@router.delete(
    "/{cart_item_id}",
    response_model=MessageOut,
    summary="Remove item from cart",
)
def remove_cart_item(
    cart_item_id: str,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    ref = _cart_collection(uid).document(cart_item_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Cart item not found")
    ref.delete()
    return MessageOut(message=f"Cart item {cart_item_id} removed")


# ---------------------------------------------------------------------------
# Clear cart
# ---------------------------------------------------------------------------
@router.delete("", response_model=MessageOut, summary="Clear entire cart")
def clear_cart(current_user: dict = Depends(get_current_user)):
    uid = current_user["uid"]
    col = _cart_collection(uid)
    docs = col.stream()
    batch = get_db().batch()
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()
    return MessageOut(message="Cart cleared")
