import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const BADGES = [
  { id: 'first', title: 'First Fit Bought', desc: 'Welcome to the ZYVON collective.', color: '#dcd0ff' },
  { id: 'trend', title: 'Trendsetter', desc: 'Assembled a complex drip combination.', color: '#ffd3b6' },
  { id: 'og', title: 'OG Crew', desc: 'VIP access granted to future drops.', color: '#c5ecd2' }
];

// Inline SVG glyphs — no lucide
const IconBag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

const IconStar = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function CartDrawer({ isOpen, onClose, cartItems, onRemoveItem, onClearCart, onUpdateQuantity }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState({});

  // Fetch real-time stock when cart opens or items change
  React.useEffect(() => {
    if (isOpen && cartItems.length > 0) {
      const fetchStock = async () => {
        try {
          const productIds = [...new Set(cartItems.map(item => item.productId))];
          const stockData = {};
          await Promise.all(productIds.map(async (id) => {
             // Dynamic import of api avoids circular dependencies if any, but we can assume api is globally available or imported above.
             // We need to import api at the top if it's not already.
             const res = await api.get(`/products/${id}`);
             stockData[id] = res.data.sizes;
          }));
          setStockInfo(stockData);
        } catch(e) { console.error('Failed to fetch stock for cart items', e); }
      };
      fetchStock();
    }
  }, [isOpen, cartItems]);

  const hasOutOfStockItems = cartItems.some(item => {
    const sizeData = stockInfo[item.productId]?.[item.size];
    return sizeData && sizeData.stock === 0;
  });

  const totalPrice = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

  const handleNextStep = () => {
    if (step === 1) {
      if (cartItems.length === 0) return;
      if (hasOutOfStockItems) {
        alert("Please remove out-of-stock items before proceeding.");
        return;
      }
      onClose();
      navigate('/checkout');
    } else if (step === 2) {
      if (!email || !address) {
        alert('Please enter both email and address.');
        return;
      }
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(3);
      }, 1000);
    } else if (step === 3) {
      onClearCart();
      setStep(1);
      onClose();
    }
  };

  const getStepWireGlow = (currentStep) => {
    if (step >= currentStep) return 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.4))';
    return 'none';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="cart-drawer-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="cart-drawer-header">
              <div className="cart-header-title">
                <IconBag />
                <span>YOUR FIT BAG</span>
              </div>
              <button onClick={onClose} className="cart-close-btn">
                <IconClose />
              </button>
            </div>

            {/* Steps Wire Progress */}
            <div className="cart-progress-wire-wrapper">
              <div className="step-point">
                <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                <span className="step-label">BAG</span>
              </div>
              <div className="step-connector">
                <svg width="100%" height="8" viewBox="0 0 100 8" fill="none" preserveAspectRatio="none">
                  <path d="M 0 4 L 100 4" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  <motion.path
                    d="M 0 4 L 100 4"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ filter: getStepWireGlow(2) }}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: step >= 2 ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                </svg>
              </div>
              <div className="step-point">
                <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                <span className="step-label">INFO</span>
              </div>
              <div className="step-connector">
                <svg width="100%" height="8" viewBox="0 0 100 8" fill="none" preserveAspectRatio="none">
                  <path d="M 0 4 L 100 4" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  <motion.path
                    d="M 0 4 L 100 4"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ filter: getStepWireGlow(3) }}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: step >= 3 ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                </svg>
              </div>
              <div className="step-point">
                <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                <span className="step-label">DONE</span>
              </div>
            </div>

            {/* Step Contents */}
            <div className="cart-drawer-content">
              {step === 1 && (
                <div className="cart-step-1">
                  {cartItems.length === 0 ? (
                    <div className="cart-empty-message">
                      <span>No items in bag. Add garments to begin.</span>
                    </div>
                  ) : (
                    <div className="cart-items-list">
                      {cartItems.map((item, idx) => {
                        const sizeData = stockInfo[item.productId]?.[item.size];
                        const isOutOfStock = sizeData && sizeData.stock === 0;
                        const availableStock = sizeData ? sizeData.stock : Infinity;
                        const atMaxStock = (item.quantity || 1) >= availableStock;

                        return (
                          <motion.div
                            key={`${item.id}-${idx}`}
                            className={`cart-item-card ${isOutOfStock ? 'out-of-stock-item' : ''}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <div className="cart-item-info">
                              <span className="cart-item-name">
                                {item.name}
                              </span>
                              <span className="cart-item-meta">
                                {item.size || 'Standard'} &bull; ₹{item.price}
                                {isOutOfStock && <span style={{ color: '#ff8888', marginLeft: '8px', fontSize: '10px' }}>[OUT OF STOCK]</span>}
                              </span>
                              <div className="cart-item-qty-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <button
                                  onClick={() => onUpdateQuantity(idx, -1)}
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >-</button>
                                <span style={{ fontSize: '12px', minWidth: '16px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.quantity || 1}</span>
                                <button
                                  onClick={() => !atMaxStock && onUpdateQuantity(idx, 1)}
                                  disabled={atMaxStock}
                                  title={atMaxStock ? `Only ${availableStock} in stock` : ''}
                                  style={{ background: atMaxStock ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: atMaxStock ? 'rgba(255,255,255,0.2)' : '#fff', width: '24px', height: '24px', borderRadius: '4px', cursor: atMaxStock ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >+</button>
                                {atMaxStock && !isOutOfStock && (
                                  <span style={{ fontSize: '9px', color: '#ffd3b6', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>MAX</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => onRemoveItem(idx)} className="cart-item-remove-btn">
                              <IconTrash />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="cart-step-2">
                  <div className="checkout-form">
                    <h4 className="checkout-subtitle">SHIPPING DETAILS</h4>
                    <div className="form-group">
                      <label>EMAIL ADDRESS</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="checkout-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>DELIVERY LOCATION</label>
                      <input
                        type="text"
                        placeholder="Shipping address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="checkout-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="cart-step-3">
                  <div className="success-banner">
                    {/* Inline sparkle — a simple 4-point star in SVG */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dcd0ff" strokeWidth="1.2" strokeLinecap="round" className="success-icon">
                      <line x1="12" y1="2" x2="12" y2="22"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
                    </svg>
                    <h4>ORDER PLACED</h4>
                    <p>Assembly is in progress.</p>
                  </div>

                  <div className="badges-unlocked-section">
                    <span className="section-label">[BADGES UNLOCKED]</span>
                    <div className="badges-grid">
                      {BADGES.map((badge) => (
                        <div key={badge.id} className="badge-card" style={{ borderColor: badge.color }}>
                          <IconStar color={badge.color} />
                          <div className="badge-details">
                            <span className="badge-title" style={{ color: badge.color }}>{badge.title}</span>
                            <span className="badge-desc">{badge.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="cart-drawer-footer">
              {step !== 3 && (
                <div className="cart-summary-row">
                  <span>SUBTOTAL</span>
                  <span className="summary-price">₹{totalPrice}</span>
                </div>
              )}
              <button
                onClick={handleNextStep}
                disabled={(cartItems.length === 0 && step === 1) || loading || hasOutOfStockItems}
                className="cart-action-btn"
              >
                <span>{loading ? 'PROCESSING...' : step === 1 ? (hasOutOfStockItems ? 'REMOVE OUT OF STOCK ITEMS' : 'PROCEED TO CHECKOUT') : step === 2 ? 'PLACE ORDER' : 'KEEP FLEXING'}</span>
                {step !== 3 && !loading && !hasOutOfStockItems && <IconArrow />}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
