"""
Admin router — endpoints exclusively for admin users.

GET  /admin/orders/active/online   → all active online orders
GET  /admin/orders/active/cod      → all active COD orders
GET  /admin/orders/all             → unified view of online + COD (with ?q= search)
GET  /admin/orders/completed       → completed orders
GET  /admin/orders/canceled        → canceled orders
PATCH /admin/orders/{order_id}/status → manually update order status (triggers review flag on completion)
GET  /admin/products               → all products (including inactive)
GET  /admin/users                  → list all users
GET  /admin/dashboard/stats        → quick stats for dashboard
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_client import get_db
from dependencies import get_admin_user
from models import AdminOrderStatusUpdate, OrderStatus, MessageOut
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from pydantic import BaseModel
from typing import Optional
import logging
from brevo_email_service import send_order_delivered_email, send_order_canceled_email


class StockUpdateIn(BaseModel):
    size: str           # e.g. "S", "M", "L", "XL"
    new_stock: int      # absolute new value (not delta)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stream_to_list(stream) -> list[dict]:
    return [{"id": doc.id, **doc.to_dict()} for doc in stream]


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

@router.get(
    "/orders/active/online",
    response_model=list[dict],
    summary="[Admin] All active online orders",
)
def get_active_online_orders(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = (
        db.collection("orders").document("active").collection("online").stream()
    )
    return _stream_to_list(docs)


@router.get(
    "/orders/active/cod",
    response_model=list[dict],
    summary="[Admin] All active COD orders",
)
def get_active_cod_orders(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = db.collection("orders").document("active").collection("cod").stream()
    return _stream_to_list(docs)


@router.get(
    "/orders/all",
    response_model=list[dict],
    summary="[Admin] Unified active orders view (online + COD) with optional search",
)
def get_all_active_orders(
    q: Optional[str] = Query(None, description="Filter by orderId, userId, or product name"),
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    online_docs = _stream_to_list(
        db.collection("orders").document("active").collection("online").stream()
    )
    cod_docs = _stream_to_list(
        db.collection("orders").document("active").collection("cod").stream()
    )

    all_orders = online_docs + cod_docs

    # Sort by createdAt descending (most recent first)
    all_orders.sort(key=lambda o: o.get("createdAt") or 0, reverse=True)

    # Optional client-side search filter
    if q:
        q_lower = q.lower()
        def _matches(order: dict) -> bool:
            if q_lower in order.get("id", "").lower():
                return True
            if q_lower in order.get("userId", "").lower():
                return True
            for p in order.get("products", []):
                if q_lower in p.get("name", "").lower():
                    return True
                if q_lower in p.get("productId", "").lower():
                    return True
            return False
        all_orders = [o for o in all_orders if _matches(o)]

    return all_orders


@router.get(
    "/orders/completed",
    response_model=list[dict],
    summary="[Admin] All completed orders",
)
def get_completed_orders(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = db.collection("orders").document("completed").collection("items").stream()
    return _stream_to_list(docs)


@router.get(
    "/orders/canceled",
    response_model=list[dict],
    summary="[Admin] All canceled orders",
)
def get_canceled_orders(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = db.collection("orders").document("canceled").collection("items").stream()
    return _stream_to_list(docs)


@router.get(
    "/orders/returns",
    response_model=list[dict],
    summary="[Admin] All pending return requests",
)
def get_pending_returns(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    # Return requests are still in the completed collection, flagged with returnStatus: "requested"
    docs = db.collection("orders").document("completed").collection("items").where("returnStatus", "==", "requested").stream()
    return _stream_to_list(docs)

@router.post(
    "/orders/{order_id}/accept_return",
    response_model=MessageOut,
    summary="[Admin] Accept a return request",
)
def accept_return(order_id: str, _admin: dict = Depends(get_admin_user)):
    db = get_db()
    # It should be in completed collection
    ref = db.collection("orders").document("completed").collection("items").document(order_id)
    doc = ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Order not found in completed collection")
    
    data = doc.to_dict()
    if data.get("returnStatus") != "requested":
        raise HTTPException(status_code=400, detail="Order does not have a pending return request")

    # Move to canceled collection (which acts as the canceled/refunded/returned pool)
    updated_data = {
        **data,
        "returnStatus": "accepted",
        "status": "returned",
        "paymentStatus": "refunded",
        "updatedAt": SERVER_TIMESTAMP
    }
    db.collection("orders").document("canceled").collection("items").document(order_id).set(updated_data)
    ref.delete()
    
    # Send Email
    uid = data.get("userId")
    if uid:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_email = user_doc.to_dict().get("email")
            if user_email:
                from brevo_email_service import send_return_accepted_email
                refunded = data.get("paymentType") == "online"
                send_return_accepted_email(user_email, order_id, data.get("grandTotal", 0), refunded, data.get("products", []))
    
    return MessageOut(message="Return accepted and moved to canceled collection")

@router.post(
    "/orders/{order_id}/reject_return",
    response_model=MessageOut,
    summary="[Admin] Reject a return request",
)
def reject_return(order_id: str, _admin: dict = Depends(get_admin_user)):
    db = get_db()
    
    # It could be in 'completed' (if pending) OR in 'canceled' (if previously accepted but now rejecting due to missing tags)
    comp_ref = db.collection("orders").document("completed").collection("items").document(order_id)
    comp_doc = comp_ref.get()
    
    canc_ref = db.collection("orders").document("canceled").collection("items").document(order_id)
    canc_doc = canc_ref.get()
    
    if comp_doc.exists:
        data = comp_doc.to_dict()
        comp_ref.update({
            "returnStatus": "rejected",
            "updatedAt": SERVER_TIMESTAMP
        })
    elif canc_doc.exists:
        data = canc_doc.to_dict()
        # Move back to completed
        updated_data = {
            **data,
            "returnStatus": "rejected",
            "status": "completed",
            "paymentStatus": "paid",
            "updatedAt": SERVER_TIMESTAMP
        }
        comp_ref.set(updated_data)
        canc_ref.delete()
    else:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Send Email
    uid = data.get("userId")
    if uid:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            user_email = user_doc.to_dict().get("email")
            if user_email:
                from brevo_email_service import send_return_rejected_email
                send_return_rejected_email(user_email, order_id, data.get("products", []))
                
    return MessageOut(message="Return rejected and reverted to completed status")

@router.get(
    "/orders/{order_id}",
    response_model=dict,
    summary="[Admin] Get any order by ID",
)
def admin_get_order(order_id: str, _admin: dict = Depends(get_admin_user)):
    db = get_db()

    paths = [
        db.collection("orders").document("active").collection("online"),
        db.collection("orders").document("active").collection("cod"),
        db.collection("orders").document("completed").collection("items"),
        db.collection("orders").document("canceled").collection("items"),
    ]
    for col in paths:
        doc = col.document(order_id).get()
        if doc.exists:
            return {"id": doc.id, **doc.to_dict()}

    raise HTTPException(status_code=404, detail="Order not found")


@router.patch(
    "/orders/{order_id}/status",
    response_model=MessageOut,
    summary="[Admin] Manually update order status (e.g., COD → completed)",
)
def update_order_status(
    order_id: str,
    body: AdminOrderStatusUpdate,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()

    # Locate the order
    source_paths = [
        db.collection("orders").document("active").collection("online"),
        db.collection("orders").document("active").collection("cod"),
        db.collection("orders").document("completed").collection("items"),
        db.collection("orders").document("canceled").collection("items"),
    ]

    found_doc = None
    found_ref = None
    for col in source_paths:
        doc = col.document(order_id).get()
        if doc.exists:
            found_doc = doc.to_dict()
            found_ref = doc.reference
            break

    if not found_doc:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = body.new_status

    # Determine target collection
    target_col = {
        OrderStatus.active_online: db.collection("orders").document("active").collection("online"),
        OrderStatus.active_cod: db.collection("orders").document("active").collection("cod"),
        OrderStatus.completed: db.collection("orders").document("completed").collection("items"),
        OrderStatus.canceled: db.collection("orders").document("canceled").collection("items"),
    }.get(new_status)

    if target_col is None:
        raise HTTPException(status_code=400, detail="Invalid target status")

    # Move document to the new collection if it's different
    target_ref = target_col.document(order_id)
    if found_ref.path != target_ref.path:
        updated_data = {**found_doc, "updatedAt": SERVER_TIMESTAMP}

        # Always write a 'status' field so frontend knows the logical state
        status_label_map = {
            OrderStatus.completed: "completed",
            OrderStatus.canceled: "canceled",
            OrderStatus.active_online: "active",
            OrderStatus.active_cod: "active",
        }
        updated_data["status"] = status_label_map.get(new_status, new_status.value)

        # If marking COD as completed, set paymentStatus → paid (admin confirms delivery)
        if new_status == OrderStatus.completed and found_doc.get("paymentType") == "cod":
            updated_data["paymentStatus"] = "paid"

        target_ref.set(updated_data)
        found_ref.delete()
        logger.info(f"Order {order_id} moved to {new_status.value} by admin")

        uid = found_doc.get("userId")
        if uid:
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                user_email = user_doc.to_dict().get("email")
                if user_email:
                    if new_status == OrderStatus.completed:
                        send_order_delivered_email(user_email, order_id, found_doc.get("grandTotal", 0), found_doc.get("products", []))
                    elif new_status == OrderStatus.canceled:
                        send_order_canceled_email(user_email, order_id, found_doc.get("grandTotal", 0), False, found_doc.get("products", []))

        # ── Review Pending flag ──────────────────────────────────────────────
        # When ANY order (online or COD) is marked completed, write a
        # reviewPending flag to the user doc so Dashboard shows the review modal.
        if new_status == OrderStatus.completed:
            uid = found_doc.get("userId")
            if uid:
                # Build a list of products with enough info for the modal
                review_products = []
                for p in found_doc.get("products", []):
                    pid = p.get("productId", "")
                    # Try to fetch product name + image from Firestore
                    try:
                        prod_doc = db.collection("products").document(pid).get()
                        if prod_doc.exists:
                            pdata = prod_doc.to_dict()
                            review_products.append({
                                "productId": pid,
                                "name": pdata.get("name", pid),
                                "imageUrl": (pdata.get("images") or [""])[0],
                            })
                        else:
                            review_products.append({"productId": pid, "name": pid, "imageUrl": ""})
                    except Exception:
                        review_products.append({"productId": pid, "name": pid, "imageUrl": ""})

                db.collection("users").document(uid).update({
                    "reviewPending": {
                        "orderId": order_id,
                        "products": review_products,
                    }
                })
                logger.info(f"Review pending flag written for user {uid}, order {order_id}")

    else:
        updates = {"updatedAt": SERVER_TIMESTAMP}
        # If admin is confirming a cancellation (order is already in canceled col)
        if new_status == OrderStatus.canceled and not found_doc.get("cancelAcknowledged"):
            updates["cancelAcknowledged"] = True
            found_ref.update(updates)
            
            # SEND EMAIL HERE
            uid = found_doc.get("userId")
            if uid:
                user_doc = db.collection("users").document(uid).get()
                if user_doc.exists:
                    user_email = user_doc.to_dict().get("email")
                    if user_email:
                        refunded = found_doc.get("paymentStatus") == "refunded"
                        send_order_canceled_email(user_email, order_id, found_doc.get("grandTotal", 0), refunded, found_doc.get("products", []))
            
            return MessageOut(message=f"Order {order_id} cancellation acknowledged and email sent.")
            
        found_ref.update(updates)

    return MessageOut(message=f"Order {order_id} updated to status '{new_status.value}'")


# ---------------------------------------------------------------------------
# Products (admin view — includes inactive)
# ---------------------------------------------------------------------------

@router.get(
    "/products",
    response_model=list[dict],
    summary="[Admin] All products including inactive",
)
def admin_list_all_products(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = db.collection("products").stream()
    return _stream_to_list(docs)


@router.patch(
    "/products/{product_id}/stock",
    response_model=MessageOut,
    summary="[Admin] Set stock for a specific product size",
)
def update_product_stock(
    product_id: str,
    body: StockUpdateIn,
    _admin: dict = Depends(get_admin_user),
):
    db = get_db()
    doc_ref = db.collection("products").document(product_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Product not found")

    data = doc.to_dict()
    sizes = data.get("sizes", {})

    if body.size not in sizes:
        raise HTTPException(
            status_code=400,
            detail=f"Size '{body.size}' does not exist for this product. Available: {list(sizes.keys())}",
        )

    # Update only the stock field for the given size, preserve price
    sizes[body.size]["stock"] = body.new_stock
    doc_ref.update({"sizes": sizes, "updatedAt": SERVER_TIMESTAMP})

    logger.info(f"Admin set stock for product {product_id} size {body.size} → {body.new_stock}")
    return MessageOut(message=f"Stock for {product_id} [{body.size}] set to {body.new_stock}")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get(
    "/users",
    response_model=list[dict],
    summary="[Admin] List all registered users",
)
def list_all_users(_admin: dict = Depends(get_admin_user)):
    db = get_db()
    docs = db.collection("users").stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        # Never expose private keys, just safe fields
        results.append(
            {
                "uid": doc.id,
                "email": data.get("email"),
                "role": data.get("role", "customer"),
                "createdAt": data.get("createdAt"),
                "orderCount": len(data.get("orders", [])),
            }
        )
    return results


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get(
    "/dashboard/stats",
    response_model=dict,
    summary="[Admin] Quick stats: order counts, revenue",
)
def dashboard_stats(_admin: dict = Depends(get_admin_user)):
    db = get_db()

    active_online = list(
        db.collection("orders").document("active").collection("online").stream()
    )
    active_cod = list(
        db.collection("orders").document("active").collection("cod").stream()
    )
    completed = list(
        db.collection("orders").document("completed").collection("items").stream()
    )
    canceled = list(
        db.collection("orders").document("canceled").collection("items").stream()
    )
    users = list(db.collection("users").stream())
    products = list(db.collection("products").where("active", "==", True).stream())

    def sum_revenue(docs) -> float:
        return sum(d.to_dict().get("grandTotal", 0) for d in docs)

    total_revenue = sum_revenue(completed)
    total_refunded = sum_revenue(canceled)

    return {
        "orders": {
            "active_online": len(active_online),
            "active_cod": len(active_cod),
            "completed": len(completed),
            "canceled": len(canceled),
            "total": len(active_online) + len(active_cod) + len(completed) + len(canceled),
        },
        "revenue": {
            "total_inr": round(total_revenue, 2),
            "total_refunded_inr": round(total_refunded, 2),
            "completed_orders": len(completed),
        },
        "users": len(users),
        "active_products": len(products),
    }

