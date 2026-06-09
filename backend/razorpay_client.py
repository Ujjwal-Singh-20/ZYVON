import razorpay
from config import get_settings
import logging

logger = logging.getLogger(__name__)

# Global client
client = None

def init_razorpay() -> None:
    """Initialize Razorpay SDK from settings. Called once at startup."""
    global client
    settings = get_settings()
    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    logger.info("Razorpay SDK configured ✓")

def create_order(amount_inr: float, receipt_id: str) -> dict:
    """
    Create a Razorpay order. Amount should be in INR (we convert to paise).
    """
    if not client:
        raise ValueError("Razorpay client not initialized")
    
    amount_paise = int(amount_inr * 100)
    data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt_id,
        "payment_capture": 1 # Auto capture
    }
    
    order = client.order.create(data=data)
    logger.info(f"Razorpay order created: {order['id']} for receipt {receipt_id}")
    return order

def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    """
    Verify the payment signature returned by the frontend.
    """
    if not client:
        raise ValueError("Razorpay client not initialized")
        
    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        logger.error(f"Signature verification failed for payment {razorpay_payment_id}")
        return False

def create_refund(payment_id: str, amount_inr: float | None = None) -> dict:
    """
    Issue a full or partial refund for a captured payment.
    amount_inr: if None → full refund; otherwise partial refund in INR.
    """
    if not client:
        raise ValueError("Razorpay client not initialized")
        
    data = {}
    if amount_inr is not None:
        data["amount"] = int(amount_inr * 100)
        
    refund = client.payment.refund(payment_id, data)
    logger.info(f"Razorpay refund created: {refund['id']} for payment {payment_id}")
    return refund

def verify_webhook_signature(payload: str, sig_header: str) -> bool:
    """Verify Razorpay webhook signature."""
    if not client:
        raise ValueError("Razorpay client not initialized")
    settings = get_settings()
    try:
        client.utility.verify_webhook_signature(payload, sig_header, settings.razorpay_webhook_secret)
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
