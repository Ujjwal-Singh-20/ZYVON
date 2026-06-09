"""
Products router.
- GET  /products        → list all active products (public)
- GET  /products/{id}   → single product (public)
- POST /products        → create product (admin only)
- PUT  /products/{id}   → update product (admin only)
- DELETE /products/{id} → soft-delete (admin only)
- POST /products/{id}/images → upload images via Cloudinary (admin only)
- DELETE /products/{id}/images/{public_id} → remove an image (admin only)
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from firebase_client import get_db
from cloudinary_client import upload_product_image, delete_product_image
from dependencies import get_admin_user, get_current_user
from models import ProductIn, ProductOut, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/products", tags=["products"])


def _doc_to_product_out(doc) -> ProductOut:
    data = doc.to_dict()
    return ProductOut(
        product_id=doc.id,
        type=data.get("type", ""),
        name=data.get("name", ""),
        description=data.get("description", ""),
        tagline=data.get("tagline", ""),
        images=data.get("images", []),
        sizes=data.get("sizes", {}),
        active=data.get("active", True),
        created_at=data.get("createdAt"),
        updated_at=data.get("updatedAt"),
    )


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=list[ProductOut], summary="List all active products")
def list_products():
    db = get_db()
    docs = (
        db.collection("products").where("active", "==", True).stream()
    )
    return [_doc_to_product_out(d) for d in docs]


@router.get("/{product_id}", response_model=ProductOut, summary="Get a single product")
def get_product(product_id: str):
    db = get_db()
    doc = db.collection("products").document(product_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")
    return _doc_to_product_out(doc)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=ProductOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product [Admin]",
)
def create_product(
    body: ProductIn,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    product_id = str(uuid.uuid4())
    payload = body.model_dump()
    payload["images"] = []
    payload["createdAt"] = SERVER_TIMESTAMP
    payload["updatedAt"] = SERVER_TIMESTAMP
    db.collection("products").document(product_id).set(payload)
    logger.info(f"Product created: {product_id}")
    return ProductOut(product_id=product_id, images=[], **body.model_dump())


@router.put(
    "/{product_id}",
    response_model=ProductOut,
    summary="Update a product [Admin]",
)
def update_product(
    product_id: str,
    body: ProductIn,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("products").document(product_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    payload = body.model_dump()
    payload["updatedAt"] = SERVER_TIMESTAMP
    ref.update(payload)

    # Return merged data
    updated = ref.get().to_dict()
    return ProductOut(
        product_id=product_id,
        images=updated.get("images", []),
        **body.model_dump(),
        created_at=updated.get("createdAt"),
        updated_at=updated.get("updatedAt"),
    )


@router.delete(
    "/{product_id}",
    response_model=MessageOut,
    summary="Soft-delete a product [Admin]",
)
def delete_product(
    product_id: str,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("products").document(product_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Product not found")
    ref.update({"active": False, "updatedAt": SERVER_TIMESTAMP})
    return MessageOut(message=f"Product {product_id} deactivated")


# ---------------------------------------------------------------------------
# Image upload / delete (Cloudinary)
# ---------------------------------------------------------------------------
@router.post(
    "/{product_id}/images",
    response_model=ProductOut,
    summary="Upload product image(s) to Cloudinary [Admin]",
)
async def upload_images(
    product_id: str,
    files: list[UploadFile] = File(...),
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("products").document(product_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_images: list[str] = doc.to_dict().get("images", [])
    new_urls: list[str] = []

    for file in files:
        content = await file.read()
        result = upload_product_image(
            content,
            public_id=f"{product_id}_{uuid.uuid4().hex[:8]}",
        )
        new_urls.append(result["secure_url"])
        logger.info(f"Uploaded image for product {product_id}: {result['public_id']}")

    all_images = existing_images + new_urls
    ref.update({"images": all_images, "updatedAt": SERVER_TIMESTAMP})

    return _doc_to_product_out(ref.get())


@router.delete(
    "/{product_id}/images",
    response_model=MessageOut,
    summary="Remove a product image from Cloudinary [Admin]",
)
def remove_image(
    product_id: str,
    public_id: str,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("products").document(product_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    delete_product_image(public_id)

    # Remove the matching URL from Firestore (match by public_id fragment)
    images: list[str] = doc.to_dict().get("images", [])
    images = [url for url in images if public_id not in url]
    ref.update({"images": images, "updatedAt": SERVER_TIMESTAMP})

    return MessageOut(message=f"Image {public_id} removed from product {product_id}")
