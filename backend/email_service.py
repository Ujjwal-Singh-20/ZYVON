import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading
import logging
from config import get_settings

logger = logging.getLogger(__name__)

def _build_products_html(products: list) -> str:
    if not products:
        return ""
    
    html = "<h3>Order Items:</h3><ul style='list-style-type: none; padding: 0;'>"
    for p in products:
        name = p.get('name', 'Product')
        size = p.get('size', '')
        qty = p.get('quantity', 1)
        price = p.get('price', 0)
        html += f"<li style='padding: 8px 0; border-bottom: 1px solid #eee;'><strong>{qty}x</strong> {name} <span style='color: #666;'>(Size: {size})</span> - ₹{price}</li>"
    html += "</ul>"
    return html

def _send_email_async(to_email: str, subject: str, html_body: str):
    """Internal function to actually send the email in a background thread."""
    settings = get_settings()
    sender_email = settings.smtp_email
    sender_password = settings.smtp_app_password
    
    if not sender_email or not sender_password:
        logger.warning(f"SMTP not configured. Skipping email to {to_email}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ZYVON <{sender_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html"))

    try:
        # Use Gmail SMTP server as default assumption based on plan
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        logger.info(f"Email sent successfully to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")

def send_order_confirmation_email(user_email: str, order_id: str, grand_total: float, products: list = None):
    """Sends order confirmation to the customer."""
    products_html = _build_products_html(products or [])
    subject = f"Order Confirmation - ZYVON #{order_id[-8:]}"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #000;">Thanks for your order!</h2>
        <p>Your order <strong>#{order_id}</strong> has been received and is being processed.</p>
        <p><strong>Grand Total:</strong> ₹{grand_total}</p>
        {products_html}
        <p>You can track your order status from your dashboard.</p>
        <br/>
        <p>Stay sharp,</p>
        <p><strong>ZYVON Team</strong></p>
      </body>
    </html>
    """
    threading.Thread(target=_send_email_async, args=(user_email, subject, html_body)).start()

def send_admin_notification_email(order_id: str, grand_total: float, payment_type: str, products: list = None):
    """Sends a notification to the admin(s) about a new order."""
    settings = get_settings()
    admin_emails = [settings.smtp_email] if settings.smtp_email else []
    
    if not admin_emails:
        logger.warning("No admin emails configured.")
        return

    products_html = _build_products_html(products or [])
    subject = f"New Order Received! #{order_id[-8:]}"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #000;">New Order Alert!</h2>
        <p>A new order has just been placed.</p>
        <ul>
          <li><strong>Order ID:</strong> {order_id}</li>
          <li><strong>Total:</strong> ₹{grand_total}</li>
          <li><strong>Payment Type:</strong> {payment_type.upper()}</li>
        </ul>
        {products_html}
        <p>Check the admin dashboard for full details.</p>
      </body>
    </html>
    """
    for admin_email in admin_emails:
        threading.Thread(target=_send_email_async, args=(admin_email, subject, html_body)).start()

def send_order_canceled_email(user_email: str, order_id: str, grand_total: float, refunded: bool = False, products: list = None):
    """Sends order cancellation notification to the customer."""
    products_html = _build_products_html(products or [])
    subject = f"Order Canceled - ZYVON #{order_id[-8:]}"
    refund_msg = "<p>Your refund has been initiated.</p>" if refunded else ""
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #ff4444;">Order Canceled</h2>
        <p>Your order <strong>#{order_id}</strong> has been successfully canceled.</p>
        <p><strong>Grand Total:</strong> ₹{grand_total}</p>
        {products_html}
        {refund_msg}
        <p>If you have any questions, feel free to reply to this email.</p>
        <br/>
        <p>Stay sharp,</p>
        <p><strong>ZYVON Team</strong></p>
      </body>
    </html>
    """
    threading.Thread(target=_send_email_async, args=(user_email, subject, html_body)).start()

def send_order_delivered_email(user_email: str, order_id: str, grand_total: float, products: list = None):
    """Sends order delivered notification to the customer."""
    products_html = _build_products_html(products or [])
    subject = f"Order Delivered! - ZYVON #{order_id[-8:]}"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #2e8b57;">Your Order has Arrived!</h2>
        <p>Great news! Your order <strong>#{order_id}</strong> has been delivered.</p>
        <p><strong>Grand Total:</strong> ₹{grand_total}</p>
        {products_html}
        <p>We hope you love your new gear. Don't forget to drop a review in your dashboard!</p>
        <br/>
        <p>Stay sharp,</p>
        <p><strong>ZYVON Team</strong></p>
      </body>
    </html>
    """
    threading.Thread(target=_send_email_async, args=(user_email, subject, html_body)).start()

def send_return_accepted_email(user_email: str, order_id: str, grand_total: float, refunded: bool = False, products: list = None):
    """Sends return accepted notification to the customer."""
    products_html = _build_products_html(products or [])
    subject = f"Return Accepted - ZYVON #{order_id[-8:]}"
    refund_msg = "<p>Your refund has been initiated and should reflect in your account within 5-7 business days.</p>" if refunded else "<p>Your return has been processed. Since you paid via COD, please reply to this email with your UPI QR code or payment details so we can process your refund online.</p>"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #2e8b57;">Return Accepted!</h2>
        <p>Your return request for order <strong>#{order_id}</strong> has been accepted.</p>
        <p><strong>Grand Total:</strong> ₹{grand_total}</p>
        {products_html}
        {refund_msg}
        <p>If you have any questions, feel free to reply to this email.</p>
        <br/>
        <p>Stay sharp,</p>
        <p><strong>ZYVON Team</strong></p>
      </body>
    </html>
    """
    threading.Thread(target=_send_email_async, args=(user_email, subject, html_body)).start()

def send_return_rejected_email(user_email: str, order_id: str, products: list = None):
    """Sends return rejected notification to the customer."""
    products_html = _build_products_html(products or [])
    subject = f"Return Request Rejected - ZYVON #{order_id[-8:]}"
    html_body = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h2 style="color: #ff4444;">Return Request Rejected</h2>
        <p>Unfortunately, your return request for order <strong>#{order_id}</strong> has been rejected.</p>
        {products_html}
        <p>This typically happens if the returned items did not meet our return policy requirements (e.g., missing original packaging or tags).</p>
        <p>If you have any questions, please reach out to our support team.</p>
        <br/>
        <p>Stay sharp,</p>
        <p><strong>ZYVON Team</strong></p>
      </body>
    </html>
    """
    threading.Thread(target=_send_email_async, args=(user_email, subject, html_body)).start()
