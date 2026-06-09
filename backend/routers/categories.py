"""
Categories router.

GET    /categories              → list all top-level categories (parentId == null)
GET    /categories/{id}         → single category
POST   /categories              → create category [Admin]
PUT    /categories/{id}         → partial update [Admin]
DELETE /categories/{id}         → delete [Admin]
"""

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_client import get_db
from dependencies import get_admin_user
from models import CategoryIn, CategoryOut, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/categories", tags=["categories"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _doc_to_category_out(doc) -> CategoryOut:
    data = doc.to_dict()
    return CategoryOut(
        categoryId=doc.id,
        name=data.get("name", ""),
        slug=data.get("slug") or data.get("name", "").lower().replace(" ", "-"),
        thumbnail=data.get("thumbnail", ""),
        parentId=data.get("parentId"),
        children=data.get("children", []),
        products=data.get("products", []),
        createdAt=data.get("createdAt"),
        updatedAt=data.get("updatedAt"),
    )


# ---------------------------------------------------------------------------
# Public: List top-level categories
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=list[CategoryOut],
    summary="List all top-level categories",
)
def list_top_level_categories():
    db = get_db()
    docs = db.collection("categories").where("parentId", "==", None).stream()
    return [_doc_to_category_out(d) for d in docs]


# ---------------------------------------------------------------------------
# Public: Get single category
# ---------------------------------------------------------------------------

@router.get(
    "/{category_id}",
    response_model=CategoryOut,
    summary="Get a single category by ID",
)
def get_category(category_id: str):
    db = get_db()
    doc = db.collection("categories").document(category_id).get()
    
    if not doc.exists:
        # Fallback to querying by slug
        docs = db.collection("categories").where("slug", "==", category_id).limit(1).stream()
        docs_list = list(docs)
        if not docs_list:
            raise HTTPException(status_code=404, detail="Category not found")
        doc = docs_list[0]
        
    return _doc_to_category_out(doc)


# ---------------------------------------------------------------------------
# Admin: Create category
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category [Admin]",
)
def create_category(
    body: CategoryIn,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    category_id = str(uuid.uuid4())
    payload = body.model_dump()
    
    if not payload.get("slug"):
        payload["slug"] = re.sub(r'[^a-z0-9]+', '-', body.name.lower()).strip('-')
        
    payload["createdAt"] = SERVER_TIMESTAMP
    payload["updatedAt"] = SERVER_TIMESTAMP

    db.collection("categories").document(category_id).set(payload)

    # If this is a child category, append its ID to the parent's children array
    if body.parentId:
        from google.cloud.firestore_v1 import ArrayUnion
        parent_ref = db.collection("categories").document(body.parentId)
        if parent_ref.get().exists:
            parent_ref.update({
                "children": ArrayUnion([category_id]),
                "updatedAt": SERVER_TIMESTAMP,
            })

    logger.info(f"Category created: {category_id} (parent: {body.parentId})")
    return CategoryOut(
        categoryId=category_id,
        **body.model_dump(),
    )


# ---------------------------------------------------------------------------
# Admin: Update category (partial update — only provided fields)
# ---------------------------------------------------------------------------

@router.put(
    "/{category_id}",
    response_model=CategoryOut,
    summary="Update a category [Admin] — partial update only",
)
def update_category(
    category_id: str,
    body: CategoryIn,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("categories").document(category_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Category not found")

    # Only update the fields that are provided (partial update, not a full rewrite)
    update_payload = {k: v for k, v in body.model_dump().items() if v is not None}
    update_payload["updatedAt"] = SERVER_TIMESTAMP
    ref.update(update_payload)

    updated_doc = ref.get()
    logger.info(f"Category updated: {category_id}")
    return _doc_to_category_out(updated_doc)


# ---------------------------------------------------------------------------
# Admin: Delete category
# ---------------------------------------------------------------------------

@router.delete(
    "/{category_id}",
    response_model=MessageOut,
    summary="Delete a category [Admin]",
)
def delete_category(
    category_id: str,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    ref = db.collection("categories").document(category_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Category not found")

    data = doc.to_dict()
    parent_id = data.get("parentId")

    # Remove this category from its parent's children array
    if parent_id:
        from google.cloud.firestore_v1 import ArrayRemove
        parent_ref = db.collection("categories").document(parent_id)
        if parent_ref.get().exists:
            parent_ref.update({
                "children": ArrayRemove([category_id]),
                "updatedAt": SERVER_TIMESTAMP,
            })

    ref.delete()
    logger.info(f"Category deleted: {category_id}")
    return MessageOut(message=f"Category {category_id} deleted successfully")
