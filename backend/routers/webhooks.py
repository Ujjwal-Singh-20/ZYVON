"""
Razorpay Webhooks router.

Handles:
  - payment.failed    → mark order as failed, restore stock
  - refund.processed  → update refund status to 'completed'
"""

from fastapi import APIRouter, Header, HTTPException, Request, status
from firebase_client import get_db
from razorpay_client import verify_webhook_signature
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _find_order_by_razorpay_order_id(db, rzp_order_id: str):
    """Scan /orders/active/online for matching razorpayOrderId."""
    docs = (
        db.collection("orders")
        .document("active")
        .collection("online")
        .where("razorpayOrderId", "==", rzp_order_id)
        .limit(1)
        .stream()
    )
    for doc in docs:
        return doc.to_dict(), doc.reference
    return None, None


# ---------------------------------------------------------------------------
# Main webhook handler
# ---------------------------------------------------------------------------
@router.post(
    "/razorpay",
    status_code=status.HTTP_200_OK,
    summary="Razorpay webhook receiver",
)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="x-razorpay-signature"),
):
    payload = await request.body()
    payload_str = payload.decode("utf-8")

    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")

    if not verify_webhook_signature(payload_str, x_razorpay_signature):
        logger.error("Invalid Razorpay webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(payload_str)
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event")
    db = get_db()

    # ------------------------------------------------------------------
    # payment.failed
    # ------------------------------------------------------------------
    if event_type == "payment.failed":
        payload_data = event.get("payload", {}).get("payment", {}).get("entity", {})
        rzp_order_id = payload_data.get("order_id")
        payment_id = payload_data.get("id")

        logger.warning(f"[webhook] payment.failed | rzp_order={rzp_order_id} pi={payment_id}")

        if rzp_order_id:
            data, ref = _find_order_by_razorpay_order_id(db, rzp_order_id)
            if ref and data.get("paymentStatus") != "paid":
                ref.update({"paymentStatus": "failed", "updatedAt": SERVER_TIMESTAMP})

                # Restore stock on failed payment
                from routers.orders import _increment_stock
                _increment_stock(db, data.get("products", []))
                logger.info(f"Order marked FAILED, stock restored")

    # ------------------------------------------------------------------
    # refund.processed
    # ------------------------------------------------------------------
    elif event_type == "refund.processed":
        payload_data = event.get("payload", {}).get("refund", {}).get("entity", {})
        payment_id = payload_data.get("payment_id")
        refund_id = payload_data.get("id")
        amount_refunded = payload_data.get("amount", 0) / 100  # convert from paise

        logger.info(f"[webhook] refund.processed | pi={payment_id} refund={refund_id}")

        # Search all paths for the order with this paymentIntentId
        paths = [
            db.collection("orders").document("active").collection("online"),
            db.collection("orders").document("active").collection("cod"),
            db.collection("orders").document("canceled").collection("items"),
            db.collection("orders").document("completed").collection("items"),
        ]

        for collection in paths:
            docs = (
                collection.where("paymentIntentId", "==", payment_id).limit(1).stream()
            )
            for doc in docs:
                doc.reference.update(
                    {
                        "paymentStatus": "refunded",
                        "refundDetails": {
                            "refundStatus": "completed",
                            "refundAmount": amount_refunded,
                            "refundId": refund_id,
                        },
                        "updatedAt": SERVER_TIMESTAMP,
                    }
                )
                logger.info(f"Order {doc.id} refund status updated to COMPLETED")
                break

    else:
        logger.debug(f"[webhook] Unhandled event type: {event_type}")

    return {"status": "ok"}
