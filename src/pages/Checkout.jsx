import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import LegalModal from '../components/LegalModal';

export default function Checkout() {
  const { cart, handleClearCart, user, authLoading } = useAppContext();
  const navigate = useNavigate();

  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');

  const [paymentType, setPaymentType] = useState('cod'); // Forced 'cod' temporarily
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModal, setLegalModal] = useState(null);

  const productTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const platformCharge = paymentType === 'online' ? 10 : 15;
  const grandTotal = productTotal + platformCharge;

  const handleCheckout = async () => {
    if (!addressLine || !city || !stateName || !pincode || !phone) return alert("Please enter your complete address and phone number.");
    if (!user) return alert("Please login first.");
    if (!termsAccepted) return alert("Please accept the Terms & Conditions to proceed.");
    setIsProcessing(true);
    
    try {
      // Stock Validation
      const productIds = [...new Set(cart.map(item => item.productId))];
      const stockData = {};
      await Promise.all(productIds.map(async (id) => {
         const res = await api.get(`/products/${id}`);
         stockData[id] = res.data.sizes;
      }));
      
      const outOfStockItems = cart.filter(item => {
        const sizeData = stockData[item.productId]?.[item.size];
        return !sizeData || item.quantity > sizeData.stock;
      });
      
      if (outOfStockItems.length > 0) {
        setIsProcessing(false);
        return alert("Some items in your cart exceed available stock or are out of stock. Please reduce their quantity or remove them to proceed.");
      }

      const addrRes = await api.post('/users/me/addresses', {
        label: "Home",
        line1: addressLine,
        city: city,
        state: stateName,
        pincode: pincode,
        phone: phone // Pass phone if backend supports it in address
      });
      const addressId = addrRes.data.address_id;

      if (paymentType === 'online') {
        const loadRazorpayScript = () => {
          return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          setIsProcessing(false);
          return alert("Razorpay SDK failed to load. Are you online?");
        }

        const res = await api.post('/orders/checkout/online', {
          payment_type: 'online',
          address_id: addressId
        });
        
        const { razorpay_order_id, amount, currency, order_id } = res.data;

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_Sz9bGNOftpgeLU',
          amount: amount.toString(),
          currency: currency,
          name: "ZYVON",
          description: "Purchase from ZYVON",
          order_id: razorpay_order_id,
          handler: async function (response) {
            try {
              setIsProcessing(true);
              await api.post('/orders/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: order_id
              });
              handleClearCart();
              alert("Payment successful! Your order has been placed and you can track it in your Dashboard.");
              navigate('/dashboard');
            } catch (verifyErr) {
              alert("Payment verification failed: " + (verifyErr.response?.data?.detail || verifyErr.message));
            } finally {
              setIsProcessing(false);
            }
          },
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: phone
          },
          theme: {
            color: "#00FF41" // ZYVON primary wire-glow color
          },
          modal: {
            ondismiss: async function() {
              // If user closes the modal, cancel the pending order to restore stock
              setIsProcessing(true);
              try {
                await api.post(`/orders/${order_id}/cancel`);
              } catch (err) {
                console.error("Failed to cancel abandoned order:", err);
              } finally {
                setIsProcessing(false);
                alert("Payment cancelled. The order has been cancelled and items are back in stock.");
              }
            }
          }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
      } else {
        await api.post('/orders/checkout/cod', {
          payment_type: 'cod',
          address_id: addressId
        });
        handleClearCart();
        alert("COD order placed! You can track it in your Dashboard.");
        navigate('/dashboard');
      }
    } catch (err) {
      alert("Checkout failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading) return <div style={{ color: '#fff', textAlign: 'center', padding: '100px' }}>Loading Auth...</div>;

  if (cart.length === 0) {
    return (
      <div className="page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <h2 style={{ fontFamily: 'var(--font-wireframe)' }}>CART IS EMPTY</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px 20px', background: 'var(--wire-glow)', color: '#000', border: 'none', cursor: 'pointer' }}>RETURN TO SHOP</button>
      </div>
    );
  }

  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ paddingTop: '100px', minHeight: '100vh', color: '#fff' }}
    >
      <div className="checkout-grid" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', gap: '40px' }}>

        {/* Left Col: Address & Payment */}
        <div className="checkout-left">
          <h2 style={{ fontFamily: 'var(--font-wireframe)', marginBottom: '30px' }}>1. SHIPPING ADDRESS</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
            <input
              type="text"
              placeholder="Street Address / Line 1"
              value={addressLine}
              onChange={e => setAddressLine(e.target.value)}
              style={{ padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{ flex: '1 1 45%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px', minWidth: '150px' }}
              />
              <input
                type="text"
                placeholder="State"
                value={stateName}
                onChange={e => setStateName(e.target.value)}
                style={{ flex: '1 1 45%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px', minWidth: '150px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Pincode / ZIP"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                style={{ flex: '1 1 45%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px', minWidth: '150px' }}
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ flex: '1 1 45%', padding: '12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px', minWidth: '150px' }}
              />
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-wireframe)', marginBottom: '20px' }}>2. PAYMENT METHOD</h2>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'not-allowed', opacity: 0.5 }}>
              <input type="radio" name="payment" checked={false} disabled />
              <span style={{ textDecoration: 'line-through' }}>Card / UPI / Netbanking</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="radio" name="payment" checked={paymentType === 'cod'} onChange={() => setPaymentType('cod')} />
              <span>Cash on Delivery</span>
            </label>
          </div>
          <p style={{ marginTop: '10px', fontSize: '13px', color: '#ffb86c' }}>
            * Currently we only accept COD orders. Online payment will start soon.
          </p>
        </div>

        {/* Right Col: Invoice */}
        <div className="checkout-right" style={{ background: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #333', height: 'fit-content' }}>
          <h3 style={{ fontFamily: 'var(--font-wireframe)', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>INVOICE</h3>

          <div className="invoice-items" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#ccc' }}>{item.quantity || 1}x {item.name}</span>
                <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed #555', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#aaa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>₹{productTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Platform Charge ({paymentType.toUpperCase()})</span>
              <span>₹{platformCharge.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #333', marginTop: '20px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 'bold', color: 'var(--wire-glow)' }}>
            <span>GRAND TOTAL</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>

          {/* T&C accept + pay button */}
          <div style={{ marginTop: '24px' }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              cursor: 'pointer', fontSize: '12px', color: '#888', lineHeight: '1.6',
              marginBottom: '16px',
            }}>
              <input
                id="terms-accept"
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--wire-glow)', flexShrink: 0 }}
              />
              <span>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--wire-glow)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                >
                  Terms &amp; Conditions
                </button>
                ,{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--wire-glow)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                >
                  Privacy Policy
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => setLegalModal('refund')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--wire-glow)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                >
                  Refund Policy
                </button>
                .
              </span>
            </label>

            <button
              onClick={handleCheckout}
              disabled={isProcessing || !termsAccepted}
              style={{
                width: '100%',
                padding: '15px',
                background: termsAccepted ? 'var(--wire-glow)' : '#1a1a1a',
                color: termsAccepted ? '#000' : '#444',
                border: termsAccepted ? 'none' : '1px solid #2a2a2a',
                borderRadius: '8px',
                fontFamily: 'var(--font-wireframe)',
                fontSize: '16px',
                cursor: (isProcessing || !termsAccepted) ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.7 : 1,
                transition: 'all 0.3s',
              }}
            >
              {isProcessing ? 'PROCESSING...' : 'PROCEED TO PAY'}
            </button>
          </div>

          {/* Legal modals triggered from checkout */}
          {legalModal && <LegalModal pageKey={legalModal} onClose={() => setLegalModal(null)} />}
        </div>

      </div>
    </motion.div>
  );
}
