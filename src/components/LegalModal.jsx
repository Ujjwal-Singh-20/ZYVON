import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LegalModal({ pageKey, onClose }) {
  // Prevent scroll bleed-through
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const pages = {
    terms: <TermsContent />,
    privacy: <PrivacyContent />,
    refund: <RefundContent />,
    contact: <ContactContent />,
  };

  const titles = {
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    refund: 'Refund, Return & Cancellation Policy',
    contact: 'Contact Us',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: '#0a0a0a',
            border: '1px solid #2a2a2a',
            borderTop: '2px solid var(--wire-glow)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 60px rgba(0,255,65,0.06)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 28px', borderBottom: '1px solid #1a1a1a', flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-primary)', letterSpacing: '1px',
              fontSize: '13px', color: 'var(--wire-glow)',
            }}>
              {titles[pageKey]}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none', border: '1px solid #333', color: '#666',
                width: '32px', height: '32px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '16px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                fontFamily: 'var(--font-primary)',
              }}
              onMouseEnter={e => { e.target.style.borderColor = '#ff4444'; e.target.style.color = '#ff4444'; }}
              onMouseLeave={e => { e.target.style.borderColor = '#333'; e.target.style.color = '#666'; }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable Body */}
          <div style={{
            overflowY: 'auto', padding: '28px', flex: 1,
            fontSize: '14px', lineHeight: '1.8', color: '#aaa',
            fontFamily: 'var(--font-primary)',
          }}>
            {pages[pageKey]}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 28px', borderTop: '1px solid #1a1a1a',
            flexShrink: 0, textAlign: 'right',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 28px', background: 'var(--wire-glow)', color: '#000',
                border: 'none', borderRadius: '6px', fontFamily: 'var(--font-primary)',
                fontSize: '12px', letterSpacing: '2px', cursor: 'pointer',
              }}
            >
              CLOSE
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Section helper ─────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{
        fontFamily: 'var(--font-primary)', letterSpacing: '1px',
        fontSize: '11px', color: 'var(--wire-glow)', marginBottom: '10px',
        textTransform: 'uppercase',
      }}>
        {title}
      </h3>
      <div style={{ color: '#999' }}>{children}</div>
    </div>
  );
}

function Effective() {
  return (
    <p style={{ fontSize: '12px', color: '#555', marginBottom: '24px', fontStyle: 'italic' }}>
      Last updated: June 2026 · Effective immediately upon account creation or purchase.
    </p>
  );
}

/* ─── Terms & Conditions ─────────────────────────────────── */
function TermsContent() {
  return (
    <>
      <Effective />
      <Section title="1. Acceptance of Terms">
        By accessing or purchasing from ZYVON, you agree to be bound by these Terms & Conditions and all
        applicable Indian laws and regulations. If you do not agree, please do not use the platform.
      </Section>
      <Section title="2. Products & Pricing">
        All product prices are listed exclusively in Indian Rupees (INR) and are inclusive of applicable taxes
        unless stated otherwise. ZYVON reserves the right to modify prices at any time without prior notice.
        Prices shown at the time of checkout are final.
      </Section>
      <Section title="3. Orders & Payment">
        By placing an order you confirm that you are at least 18 years of age and that the payment details
        provided are valid. ZYVON accepts payments via Razorpay (UPI, Credit/Debit Cards, Netbanking) and
        Cash on Delivery (COD) where available. An order is only confirmed after successful payment
        verification or COD acceptance.
      </Section>
      <Section title="4. Shipping & Delivery">
        ZYVON aims to dispatch orders within 3–5 business days. Delivery timelines depend on your location
        and the courier partner. ZYVON is not responsible for delays caused by third-party logistics,
        natural calamities, or government restrictions.
      </Section>
      <Section title="5. Cancellation">
        Orders may be cancelled within 24 hours of placement from your Dashboard. After 24 hours,
        cancellations may not be possible. Refer to our Refund & Cancellation Policy for full details.
      </Section>
      <Section title="6. Intellectual Property">
        All content on ZYVON — including logos, product designs, photographs, and text — is the property
        of ZYVON and protected under applicable intellectual property laws. Unauthorised reproduction or
        distribution is prohibited.
      </Section>
      <Section title="7. Limitation of Liability">
        ZYVON shall not be liable for any indirect, incidental, or consequential damages arising from the
        use of the platform or products. Our total liability shall not exceed the amount paid for the
        specific order in question.
      </Section>
      <Section title="8. Governing Law">
        These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
        jurisdiction of the courts in India.
      </Section>
      <Section title="9. Contact">
        For any queries regarding these Terms, contact us at{' '}
        <a href="mailto:priyadarshih99@gmail.com" style={{ color: 'var(--wire-glow)' }}>
          priyadarshih99@gmail.com
        </a>.
      </Section>
    </>
  );
}

/* ─── Privacy Policy ─────────────────────────────────────── */
function PrivacyContent() {
  return (
    <>
      <Effective />
      <Section title="1. Information We Collect">
        We collect information you provide directly, including your name, email address, phone number,
        and shipping address when you create an account or place an order.
      </Section>
      <Section title="2. Why We Store Your Address & Phone Number">
        <p>Your shipping address and phone number are stored for the following reasons:</p>
        <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '2' }}>
          <li><strong style={{ color: '#ccc' }}>Order Fulfilment:</strong> To dispatch your order to the correct delivery address and enable the courier to contact you.</li>
          <li><strong style={{ color: '#ccc' }}>Historical Record:</strong> A snapshot of your address at the time of each order is stored within the order record. This ensures accurate records even if you later update your address profile.</li>
          <li><strong style={{ color: '#ccc' }}>Refunds & Disputes:</strong> To verify your identity and facilitate any refund or return requests.</li>
          <li><strong style={{ color: '#ccc' }}>Customer Support:</strong> To contact you regarding order status, delays, or issues with your delivery.</li>
        </ul>
      </Section>
      <Section title="3. Data Storage & Security">
        All personal data is stored securely using Google Firebase (Firestore) with industry-standard
        encryption in transit and at rest. Access is restricted to authorised personnel only. We do not
        sell, rent, or share your personal data with third parties for marketing purposes.
      </Section>
      <Section title="4. Payment Data">
        ZYVON does not store any card numbers or sensitive payment information. All payment transactions
        are processed securely by Razorpay, which is PCI-DSS compliant. We only retain the Razorpay
        Payment ID and Order ID for record-keeping.
      </Section>
      <Section title="5. Cookies">
        We use minimal, essential cookies to maintain your login session and cart state. We do not use
        advertising or tracking cookies.
      </Section>
      <Section title="6. Your Rights">
        You have the right to access, correct, or request deletion of your personal data. To exercise
        these rights, contact us at{' '}
        <a href="mailto:priyadarshih99@gmail.com" style={{ color: 'var(--wire-glow)' }}>
          priyadarshih99@gmail.com
        </a>.
      </Section>
      <Section title="7. Changes to This Policy">
        We may update this Privacy Policy from time to time. Continued use of the platform after
        changes constitutes your acceptance of the revised policy.
      </Section>
    </>
  );
}

/* ─── Refund / Return / Cancellation ────────────────────── */
function RefundContent() {
  return (
    <>
      <Effective />
      <Section title="Cancellation Policy">
        <p>You may cancel your order within <strong style={{ color: '#ccc' }}>24 hours</strong> of placing it,
          directly from your Dashboard. After 24 hours, orders enter processing and cannot be cancelled.</p>
        <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '2' }}>
          <li><strong style={{ color: '#ccc' }}>Online Payments:</strong> A full refund will be initiated to your original payment method.</li>
          <li><strong style={{ color: '#ccc' }}>Cash on Delivery:</strong> No payment is involved; your order is simply voided.</li>
        </ul>
      </Section>
      <Section title="Refund Timeline">
        <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
          <li>Refund is initiated within <strong style={{ color: '#ccc' }}>24–48 hours</strong> of a successful cancellation request.</li>
          <li>The amount is credited back to your original payment method within <strong style={{ color: '#ccc' }}>5–7 business days</strong>, depending on your bank or payment provider.</li>
          <li>UPI refunds are typically processed within 1–2 business days.</li>
        </ul>
      </Section>
      <Section title="Return Policy">
        <p>ZYVON accepts return requests under the following conditions:</p>
        <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '2' }}>
          <li>Item received is <strong style={{ color: '#ccc' }}>damaged, defective, or incorrect</strong>.</li>
          <li>Return must be requested within <strong style={{ color: '#ccc' }}>48 hours</strong> of delivery.</li>
          <li>Items must be unused, unwashed, with original tags and packaging intact.</li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          To initiate a return, email{' '}
          <a href="mailto:priyadarshih99@gmail.com" style={{ color: 'var(--wire-glow)' }}>
            priyadarshih99@gmail.com
          </a>{' '}
          with your Order ID and photos of the issue.
        </p>
      </Section>
      <Section title="Non-Returnable Items">
        Items that have been worn, washed, altered, or are missing original packaging/tags are not eligible
        for return or exchange.
      </Section>
      <Section title="How to Request a Refund">
        <ol style={{ paddingLeft: '20px', lineHeight: '2' }}>
          <li>Log in to your ZYVON account and navigate to <strong style={{ color: '#ccc' }}>Dashboard → My Orders</strong>.</li>
          <li>Click <strong style={{ color: '#ccc' }}>Cancel Order</strong> within the 24-hour window (for pre-shipment cancellations).</li>
          <li>For post-delivery returns, email us with Order ID and issue description.</li>
          <li>Once approved, your refund will be processed within 5–7 business days.</li>
        </ol>
      </Section>
    </>
  );
}

/* ─── Contact Us ─────────────────────────────────────────── */
function ContactContent() {
  return (
    <>
      <p style={{ marginBottom: '24px', color: '#888' }}>
        Our support team is available Monday to Saturday, 10:00 AM – 6:00 PM IST. We typically respond
        within one business day.
      </p>
      <Section title="Support Email">
        <a href="mailto:priyadarshih99@gmail.com" style={{ color: 'var(--wire-glow)', fontSize: '15px' }}>
          priyadarshih99@gmail.com
        </a>
        <p style={{ marginTop: '6px', fontSize: '12px', color: '#555' }}>
          For order issues, refunds, or general queries.
        </p>
      </Section>
      <Section title="Phone">
        <a href="tel:+918278336549" style={{ color: 'var(--wire-glow)', fontSize: '15px' }}>
          +91 82783 36549
        </a>
        <p style={{ marginTop: '6px', fontSize: '12px', color: '#555' }}>
          Available Mon–Sat, 10:00 AM – 6:00 PM IST.
        </p>
      </Section>
      <Section title="Owner / Support Contact">
        <p>Harsh Priyadarshi</p>
      </Section>
      <Section title="Business Address">
        <div style={{
          background: '#111', border: '1px dashed #2a2a2a', borderRadius: '8px',
          padding: '16px', color: '#555', fontStyle: 'italic', fontSize: '13px',
        }}>
          559 Jawahar Colony, Khand B NIT , Faridabad, Haryana-121005
        </div>
      </Section>
      <Section title="Response Time">
        <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
          <li>Email: within 1 business day</li>
          <li>Phone: immediate, during business hours</li>
          <li>Order-related queries: resolved within 2 business days</li>
        </ul>
      </Section>
    </>
  );
}
