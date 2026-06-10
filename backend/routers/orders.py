"""
Orders router.

POST /orders/checkout/online  → Stripe checkout session
POST /orders/checkout/cod     → COD order
GET  /orders                  → list user's orders
GET  /orders/{order_id}       → single order
POST /orders/{order_id}/cancel → cancel within 24 hrs
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_client import get_db
from dependencies import get_current_user
from razorpay_client import create_order, create_refund
from brevo_email_service import (
    send_order_confirmation_email,
    send_admin_notification_email,
    send_order_canceled_email
)
from config import get_settings
from models import (
    OrderIn,
    OrderOut,
    RazorpayCheckoutOut,
    CODOrderOut,
    CancelOrderOut,
    OrderProduct,
    PaymentStatus,
    PaymentType,
    RefundDetails,
    RefundStatus,
)
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orders", tags=["orders"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_cart_items(uid: str) -> list[dict]:
    db = get_db()
    docs = db.collection("users").document(uid).collection("cart").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def _decrement_stock(db, cart_items: list[dict]) -> None:
    """Decrement stock for each cart item in a Firestore batch."""
    batch = db.batch()
    for item in cart_items:
        prod_ref = db.collection("products").document(item["productId"])
        prod_doc = prod_ref.get()
        if not prod_doc.exists:
            raise HTTPException(status_code=404, detail=f"Product {item['productId']} not found")
        sizes = prod_doc.to_dict().get("sizes", {})
        size = item["size"]
        current_stock = sizes.get(size, {}).get("stock", 0)
        if current_stock < item["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {item['productId']} size {size}",
            )
        sizes[size]["stock"] = current_stock - item["quantity"]
        batch.update(prod_ref, {"sizes": sizes, "updatedAt": SERVER_TIMESTAMP})
    batch.commit()


def _increment_stock(db, products: list[dict]) -> None:
    """Restore stock for canceled orders."""
    batch = db.batch()
    for item in products:
        prod_ref = db.collection("products").document(item["productId"])
        prod_doc = prod_ref.get()
        if not prod_doc.exists:
            continue
        sizes = prod_doc.to_dict().get("sizes", {})
        size = item["size"]
        if size in sizes:
            sizes[size]["stock"] = sizes[size].get("stock", 0) + item["quantity"]
            batch.update(prod_ref, {"sizes": sizes, "updatedAt": SERVER_TIMESTAMP})
    batch.commit()


def _clear_cart(db, uid: str) -> None:
    """Delete all cart documents for the user."""
    cart_ref = db.collection("users").document(uid).collection("cart")
    docs = cart_ref.stream()
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()


def _get_order_path(payment_type: str, payment_status: str = "paid") -> tuple[str, str, str]:
    """Return (collection, sub1, sub2) path for an order."""
    if payment_type == "online":
        return ("orders", "active", "online")
    return ("orders", "active", "cod")


def _find_order(db, order_id: str) -> tuple[dict | None, object | None]:
    """
    Search for an order across all known paths.
    Returns (data_dict, doc_ref) or (None, None).
    """
    paths = [
        ["orders", "active", "online"],
        ["orders", "active", "cod"],
        ["orders", "completed"],
        ["orders", "canceled"],
    ]
    for path in paths:
        if len(path) == 3:
            ref = (
                db.collection(path[0])
                .document(path[1])
                .collection(path[2])
                .document(order_id)
            )
        else:
            ref = db.collection(path[0]).document(path[1]).collection("items").document(order_id)
        doc = ref.get()
        if doc.exists:
            return doc.to_dict(), ref
    return None, None


# ---------------------------------------------------------------------------
# Checkout — Online (Stripe)
# ---------------------------------------------------------------------------
@router.post(
    "/checkout/online",
    response_model=RazorpayCheckoutOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Razorpay order (online payment)",
)
def checkout_online(
    body: OrderIn,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    email = current_user.get("email", "")
    settings = get_settings()
    db = get_db()

    # Validate address
    addr_ref = (
        db.collection("users").document(uid).collection("addresses").document(body.address_id)
    )
    addr_doc = addr_ref.get()
    if not addr_doc.exists:
        raise HTTPException(status_code=404, detail="Address not found")
    address_data = addr_doc.to_dict()

    # Read cart
    cart_items = _get_cart_items(uid)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_amount = 0.0
    order_products = []

    for item in cart_items:
        unit_price = item["price"]
        qty = item["quantity"]
        total_amount += unit_price * qty
        order_products.append(
            {
                "productId": item["productId"],
                "size": item["size"],
                "quantity": qty,
                "price": unit_price,
                "name": item.get("name", "Product")
            }
        )

    platform_charge = settings.platform_charge_online
    grand_total = total_amount + platform_charge
    order_id = str(uuid.uuid4())

    # Create Razorpay Order first, so if it fails, stock isn't incorrectly decremented
    try:
        rzp_order = create_order(amount_inr=grand_total, receipt_id=order_id)
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize payment gateway.")

    # Decrement stock immediately (reserve inventory)
    _decrement_stock(db, cart_items)

    # Persist order in Firestore
    cancellation_deadline = datetime.now(timezone.utc) + timedelta(hours=24)
    order_doc = {
        "orderId": order_id,
        "userId": uid,
        "products": order_products,
        "totalAmount": total_amount,
        "platformCharge": platform_charge,
        "grandTotal": grand_total,
        "currency": "INR",
        "paymentType": "online",
        "paymentStatus": "pending",
        "razorpayOrderId": rzp_order["id"],
        "addressId": body.address_id,
        "shippingAddress": address_data,
        "cancellationDeadline": cancellation_deadline,
        "refundDetails": None,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    }

    db.collection("orders").document("active").collection("online").document(order_id).set(
        order_doc
    )

    # Link order to user
    db.collection("users").document(uid).update(
        {"orders": __import__("google.cloud.firestore_v1", fromlist=["ArrayUnion"]).ArrayUnion([order_id])}
    )

    logger.info(f"Online order {order_id} created, Razorpay Order {rzp_order['id']}")
    return RazorpayCheckoutOut(
        razorpay_order_id=rzp_order["id"],
        order_id=order_id,
        amount=int(grand_total * 100),
        currency="INR"
    )

from models import VerifyPaymentIn
from razorpay_client import verify_payment_signature
from models import MessageOut

@router.post(
    "/verify",
    response_model=MessageOut,
    summary="Verify Razorpay signature after payment",
)
def verify_payment(
    body: VerifyPaymentIn,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    data, ref = _find_order(db, body.order_id)
    
    if not data or not ref:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if data["userId"] != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Verify Signature
    is_valid = verify_payment_signature(
        razorpay_order_id=body.razorpay_order_id,
        razorpay_payment_id=body.razorpay_payment_id,
        razorpay_signature=body.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Clear cart now that payment is confirmed
    _clear_cart(db, current_user["uid"])

    # Update status to paid and move to completed
    ref.update({
        "paymentStatus": "paid",
        "paymentIntentId": body.razorpay_payment_id, # Reusing this field to store payment ID
        "updatedAt": SERVER_TIMESTAMP
    })
    
    completed_data = {
        **data, 
        "paymentStatus": "paid", 
        "paymentIntentId": body.razorpay_payment_id
    }
    db.collection("orders").document("completed").collection("items").document(
        data["orderId"]
    ).set(completed_data)

    # Send Emails
    user_email = current_user.get("email")
    if user_email:
        send_order_confirmation_email(user_email, data["orderId"], data["grandTotal"], data.get("products", []))
    send_admin_notification_email(data["orderId"], data["grandTotal"], data["paymentType"], data.get("products", []))

    return MessageOut(message="Payment verified successfully")



# ---------------------------------------------------------------------------
# Checkout — COD
# ---------------------------------------------------------------------------
@router.post(
    "/checkout/cod",
    response_model=CODOrderOut,
    status_code=status.HTTP_201_CREATED,
    summary="Place a Cash on Delivery order",
)
def checkout_cod(
    body: OrderIn,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["uid"]
    settings = get_settings()
    db = get_db()

    # Validate address
    addr_ref = (
        db.collection("users").document(uid).collection("addresses").document(body.address_id)
    )
    addr_doc = addr_ref.get()
    if not addr_doc.exists:
        raise HTTPException(status_code=404, detail="Address not found")
    address_data = addr_doc.to_dict()

    # Read cart
    cart_items = _get_cart_items(uid)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_amount = sum(i["price"] * i["quantity"] for i in cart_items)
    platform_charge = settings.platform_charge_cod
    grand_total = total_amount + platform_charge
    order_id = str(uuid.uuid4())

    order_products = [
        {
            "productId": i["productId"],
            "size": i["size"],
            "quantity": i["quantity"],
            "price": i["price"],
            "name": i.get("name", "Product"),
            "imageUrl": i.get("imageUrl", i.get("image", ""))
        }
        for i in cart_items
    ]

    # Decrement stock
    _decrement_stock(db, cart_items)

    # Persist order
    cancellation_deadline = datetime.now(timezone.utc) + timedelta(hours=24)
    order_doc = {
        "orderId": order_id,
        "userId": uid,
        "products": order_products,
        "totalAmount": total_amount,
        "platformCharge": platform_charge,
        "grandTotal": grand_total,
        "currency": "INR",
        "paymentType": "cod",
        "paymentStatus": "pending",
        "addressId": body.address_id,
        "shippingAddress": address_data,
        "cancellationDeadline": cancellation_deadline,
        "refundDetails": None,
        "createdAt": SERVER_TIMESTAMP,
        "updatedAt": SERVER_TIMESTAMP,
    }

    db.collection("orders").document("active").collection("cod").document(order_id).set(order_doc)

    from google.cloud.firestore_v1 import ArrayUnion
    db.collection("users").document(uid).update({"orders": ArrayUnion([order_id])})

    _clear_cart(db, uid)

    # Send Emails
    user_email = current_user.get("email")
    if user_email:
        send_order_confirmation_email(user_email, order_id, grand_total, order_products)
    send_admin_notification_email(order_id, grand_total, "cod", order_products)

    logger.info(f"COD order {order_id} created")
    return CODOrderOut(order_id=order_id, grand_total=grand_total)


# ---------------------------------------------------------------------------
# List user orders
# ---------------------------------------------------------------------------
@router.get("", response_model=list[dict], summary="Get all orders for current user")
def list_orders(current_user: dict = Depends(get_current_user)):
    uid = current_user["uid"]
    db = get_db()
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        return []

    order_ids: list[str] = user_doc.to_dict().get("orders", [])
    results = []
    for oid in order_ids:
        data, _ = _find_order(db, oid)
        if data:
            # Security: only return orders that actually belong to this user
            if data.get("userId") != uid:
                logger.warning(
                    f"Order {oid} in user {uid}'s list but belongs to {data.get('userId')} — skipping"
                )
                continue
            results.append(data)
    return results


# ---------------------------------------------------------------------------
# Single order
# ---------------------------------------------------------------------------
@router.get("/{order_id}", response_model=dict, summary="Get a single order")
def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    data, _ = _find_order(db, order_id)
    if not data:
        raise HTTPException(status_code=404, detail="Order not found")
    if data["userId"] != current_user["uid"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return data


# ---------------------------------------------------------------------------
# Cancel order (within 24 hrs)
# ---------------------------------------------------------------------------
@router.post("/{order_id}/cancel", response_model=CancelOrderOut, summary="Cancel an order")
def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    data, ref = _find_order(db, order_id)

    if not data:
        raise HTTPException(status_code=404, detail="Order not found")
    if data["userId"] != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if data.get("paymentStatus") == "refunded":
        raise HTTPException(status_code=400, detail="Order already refunded")

    # Check cancellation window
    deadline = data.get("cancellationDeadline")
    if deadline:
        now = datetime.now(timezone.utc)
        if hasattr(deadline, "astimezone"):
            deadline = deadline.astimezone(timezone.utc).replace(tzinfo=timezone.utc)
        if isinstance(deadline, datetime) and now > deadline:
            raise HTTPException(
                status_code=400,
                detail="Cancellation window (24 hrs) has passed. Contact support.",
            )

    refund_id = None

    # Online payment → Razorpay refund
    if data.get("paymentType") == "online" and data.get("paymentStatus") == "paid":
        payment_intent_id = data.get("paymentIntentId")
        if payment_intent_id:
            try:
                refund = create_refund(payment_intent_id, amount_inr=data["grandTotal"])
                refund_id = refund["id"]
                ref.update(
                    {
                        "paymentStatus": "refunded",
                        "refundDetails": {
                            "refundStatus": "initiated",
                            "refundAmount": data["grandTotal"],
                            "refundId": refund_id,
                        },
                        "updatedAt": SERVER_TIMESTAMP,
                    }
                )
            except Exception as e:
                logger.error(f"Refund failed: {e}")
                raise HTTPException(status_code=500, detail="Refund processing failed")

    # Always restore stock on cancellation
    _increment_stock(db, data.get("products", []))

    # Move to canceled collection
    canceled_doc = {
        **data, 
        "paymentStatus": data.get("paymentStatus", "pending"), 
        "status": "canceled",
        "updatedAt": SERVER_TIMESTAMP
    }
    db.collection("orders").document("canceled").collection("items").document(order_id).set(
        canceled_doc
    )
    ref.delete()

    logger.info(f"Order {order_id} canceled by user {current_user['uid']}")
    
    return CancelOrderOut(
        order_id=order_id,
        refund_id=refund_id,
        message="Order canceled successfully" + (" and refund initiated" if refund_id else ""),
    )

@router.post(
    "/{order_id}/return_request",
    response_model=dict,
    summary="User requests a return/refund for a delivered order",
)
def user_request_return(order_id: str, current_user: dict = Depends(get_current_user)):
    """
    Sets returnStatus to 'requested' for a completed order.
    The frontend should ensure this is only called within 7 days of delivery.
    """
    db = get_db()
    ref = db.collection("orders").document("completed").collection("items").document(order_id)
    doc = ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Completed order not found")

    data = doc.to_dict()
    if data.get("userId") != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    if data.get("returnStatus"):
        raise HTTPException(status_code=400, detail="Return already requested")

    ref.update({
        "returnStatus": "requested",
        "updatedAt": SERVER_TIMESTAMP
    })

    logger.info(f"User {current_user['uid']} requested return for order {order_id}")
    return {"message": "Return requested successfully"}
