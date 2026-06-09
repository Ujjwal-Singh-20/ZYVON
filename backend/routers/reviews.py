"""
Reviews router.

POST   /reviews/{product_id}          → submit or edit a review [Auth]
GET    /reviews/{product_id}          → get all reviews for a product (public)
GET    /reviews/{product_id}/mine     → get current user's own review [Auth]
"""

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_client import get_db
from dependencies import get_current_user
from models import ReviewIn, ReviewItem, ReviewsOut, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP, ArrayUnion, Increment
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reviews", tags=["reviews"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_has_completed_order_with_product(db, uid: str, product_id: str) -> bool:
    """
    Check if the user has any completed order that contains this product.
    This guards against review spam from non-buyers.
    """
    completed_docs = (
        db.collection("orders")
        .document("completed")
        .collection("items")
        .where("userId", "==", uid)
        .stream()
    )
    for doc in completed_docs:
        order = doc.to_dict()
        products = order.get("products", [])
        for p in products:
            if p.get("productId") == product_id:
                return True
    return False


def _get_existing_review_index(review_list: list, uid: str) -> int:
    """Return the index of the user's existing review in the list, or -1."""
    for i, r in enumerate(review_list):
        if r.get("userId") == uid:
            return i
    return -1


# ---------------------------------------------------------------------------
# Submit or Edit Review
# ---------------------------------------------------------------------------

@router.post(
    "/{product_id}",
    response_model=MessageOut,
    status_code=status.HTTP_200_OK,
    summary="Submit or edit a review for a product [Auth]",
)
def submit_or_edit_review(
    product_id: str,
    body: ReviewIn,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    db = get_db()

    # Validate product exists
    prod_ref = db.collection("products").document(product_id)
    prod_doc = prod_ref.get()
    if not prod_doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate the user has actually bought this product
    if not _user_has_completed_order_with_product(db, uid, product_id):
        raise HTTPException(
            status_code=403,
            detail="You can only review products from completed orders",
        )

    prod_data = prod_doc.to_dict()
    reviews_data = prod_data.get("reviews", {"count": 0, "list": []})
    review_list: list = reviews_data.get("list", [])

    new_review_entry = {
        "userId": uid,
        "rating": body.rating,
        "text": body.text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    existing_idx = _get_existing_review_index(review_list, uid)
    is_edit = existing_idx != -1

    if is_edit:
        # Replace the existing review in-place, no count change
        review_list[existing_idx] = new_review_entry
        prod_ref.update({
            "reviews.list": review_list,
            "updatedAt": SERVER_TIMESTAMP,
        })
        logger.info(f"User {uid} edited review for product {product_id}")
    else:
        # New review: append to list, increment count
        prod_ref.update({
            "reviews.list": ArrayUnion([new_review_entry]),
            "reviews.count": Increment(1),
            "updatedAt": SERVER_TIMESTAMP,
        })
        logger.info(f"User {uid} submitted new review for product {product_id}")

    # Clear this product from reviewPending on the user doc
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        pending = user_data.get("reviewPending")
        updates = {"reviewedProductIds": ArrayUnion([product_id])}
        
        if pending and isinstance(pending, dict):
            pending_products = pending.get("products", [])
            # Remove this product from the pending list
            updated_products = [
                p for p in pending_products if p.get("productId") != product_id
            ]
            if updated_products:
                updates["reviewPending.products"] = updated_products
            else:
                # All reviews done — clear the whole reviewPending field
                updates["reviewPending"] = None
                
        user_ref.update(updates)

    action = "updated" if is_edit else "submitted"
    return MessageOut(message=f"Review {action} successfully")


# ---------------------------------------------------------------------------
# Get All Reviews (Public)
# ---------------------------------------------------------------------------

@router.get(
    "/{product_id}",
    response_model=ReviewsOut,
    summary="Get all reviews for a product (public)",
)
def get_reviews(product_id: str):
    db = get_db()
    prod_doc = db.collection("products").document(product_id).get()
    if not prod_doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews_data = prod_doc.to_dict().get("reviews", {"count": 0, "list": []})
    return ReviewsOut(
        count=reviews_data.get("count", 0),
        list=reviews_data.get("list", []),
    )


# ---------------------------------------------------------------------------
# Get Current User's Review for a Product (Auth)
# ---------------------------------------------------------------------------

@router.get(
    "/{product_id}/mine",
    response_model=ReviewItem | None,
    summary="Get the current user's review for a product [Auth]",
)
def get_my_review(
    product_id: str,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    db = get_db()

    prod_doc = db.collection("products").document(product_id).get()
    if not prod_doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    review_list = prod_doc.to_dict().get("reviews", {}).get("list", [])
    for r in review_list:
        if r.get("userId") == uid:
            return ReviewItem(**r)

    return None
