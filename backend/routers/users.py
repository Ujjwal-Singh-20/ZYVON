"""
Users router — profile & saved address management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_client import get_db
from dependencies import get_current_user
from models import UserOut, UserRole, AddressIn, AddressOut, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserOut, summary="Get current user profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["uid"]
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    data = doc.to_dict()
    return UserOut(
        uid=uid,
        email=data["email"],
        role=UserRole(data.get("role", "customer")),
        created_at=data.get("createdAt"),
        reviewPending=data.get("reviewPending"),
        reviewedProductIds=data.get("reviewedProductIds", [])
    )


# ---------------------------------------------------------------------------
# Addresses
# ---------------------------------------------------------------------------
@router.get(
    "/me/addresses",
    response_model=list[AddressOut],
    summary="List all saved addresses",
)
def list_addresses(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["uid"]
    docs = db.collection("users").document(uid).collection("addresses").stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        results.append(AddressOut(address_id=doc.id, **data))
    return results


@router.post(
    "/me/addresses",
    response_model=AddressOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new address",
)
def add_address(
    body: AddressIn,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["uid"]
    address_id = str(uuid.uuid4())
    ref = (
        db.collection("users")
        .document(uid)
        .collection("addresses")
        .document(address_id)
    )
    payload = body.model_dump()
    payload["createdAt"] = SERVER_TIMESTAMP
    ref.set(payload)
    logger.info(f"Address {address_id} saved for user {uid}")
    return AddressOut(address_id=address_id, **body.model_dump())


@router.put(
    "/me/addresses/{address_id}",
    response_model=AddressOut,
    summary="Update a saved address",
)
def update_address(
    address_id: str,
    body: AddressIn,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["uid"]
    ref = (
        db.collection("users")
        .document(uid)
        .collection("addresses")
        .document(address_id)
    )
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Address not found")
    payload = body.model_dump()
    payload["updatedAt"] = SERVER_TIMESTAMP
    ref.update(payload)
    return AddressOut(address_id=address_id, **body.model_dump())


@router.delete(
    "/me/addresses/{address_id}",
    response_model=MessageOut,
    summary="Delete a saved address",
)
def delete_address(
    address_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = current_user["uid"]
    ref = (
        db.collection("users")
        .document(uid)
        .collection("addresses")
        .document(address_id)
    )
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Address not found")
    ref.delete()
    return MessageOut(message=f"Address {address_id} deleted")
