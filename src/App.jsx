import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';

import Loader from './components/Loader';
import PlaylistToggle from './components/PlaylistToggle';
import CartDrawer from './components/CartDrawer';
import { AppProvider, useAppContext } from './context/AppContext';

import Home from './pages/Home';
import Checkout from './pages/Checkout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import CategoryPage from './pages/CategoryPage';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

const NAV_LABELS = ['Shop', 'The Tea'];
const NAV_HREFS = ['/#collection', '/#tea'];
const NAV_ACCENT_COLORS = ['#dcd0ff', '#ffd3b6'];

function Layout() {
  const { cart, isCartOpen, setIsCartOpen, cartWiggle, handleRemoveItem, handleClearCart, handleUpdateQuantity, user, isAdmin, loginWithGoogle, logout, glowColor } = useAppContext();

  const [hoveredNavIndex, setHoveredNavIndex] = useState(null);
  const [wireTarget, setWireTarget] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navContainerRef = useRef(null);
  const logoRef = useRef(null);
  const navLinkRefs = useRef([]);
  const navCanvasRef = useRef(null);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavEnter = (idx) => {
    setHoveredNavIndex(idx);
    const linkEl = navLinkRefs.current[idx];
    const canvasEl = navCanvasRef.current;
    const logoEl = logoRef.current;
    if (!linkEl || !canvasEl || !logoEl) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const linkRect = linkEl.getBoundingClientRect();
    const logoRect = logoEl.getBoundingClientRect();

    const startX = logoRect.right - canvasRect.left;
    const midY = canvasRect.height / 2;
    const endX = linkRect.left - canvasRect.left + linkRect.width / 2;
    const endY = linkRect.top - canvasRect.top + linkRect.height / 2;

    setWireTarget({ startX, midY, endX, endY, color: NAV_ACCENT_COLORS[idx] });
  };

  const handleNavLeave = () => {
    setHoveredNavIndex(null);
    setWireTarget(null);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-wrapper">
      <div className="bg-tech-grid"></div>
      <div className="bg-glow-container">
        <div className="bg-glow-layer" style={{ '--glow-color': glowColor, transition: 'background 0.8s ease' }}></div>
      </div>

      {/* Navigation Bar */}
      <header className="navbar" style={{ zIndex: 100 }}>
        <div className="nav-container" ref={navContainerRef}>
          <div className="logo-section" ref={logoRef}>
            <Link to="/" className="logo" style={{ textDecoration: 'none', color: 'inherit' }}>ZYVON</Link>
            <span className="logo-dot"></span>
          </div>

          <div className="nav-wire-canvas" ref={navCanvasRef}>
            <svg width="100%" height="100%" fill="none">
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <AnimatePresence>
                {wireTarget && (
                  <motion.path
                    key={hoveredNavIndex}
                    d={`M ${wireTarget.startX} ${wireTarget.midY} L ${wireTarget.endX} ${wireTarget.endY}`}
                    stroke={wireTarget.color}
                    strokeWidth="1"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ filter: `drop-shadow(0 0 4px ${wireTarget.color})` }}
                  />
                )}
              </AnimatePresence>
            </svg>
          </div>

          <nav className="nav-links">
            {NAV_LABELS.map((label, idx) => {
              return (
                <a
                  key={label}
                  href={NAV_HREFS[idx].startsWith('/') ? NAV_HREFS[idx] : `/${NAV_HREFS[idx]}`}
                  className={`nav-link-item ${hoveredNavIndex === idx ? 'nav-link-active' : ''}`}
                  ref={(el) => (navLinkRefs.current[idx] = el)}
                  onMouseEnter={() => handleNavEnter(idx)}
                  onMouseLeave={handleNavLeave}
                  style={hoveredNavIndex === idx ? { color: NAV_ACCENT_COLORS[idx], textShadow: `0 0 10px ${NAV_ACCENT_COLORS[idx]}` } : {}}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
                  aria-label="Profile"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </Link>
                <button onClick={logout} className="nav-link-item" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#ff4444', fontSize: '0.85rem' }}>Logout</button>
              </>
            ) : (
              <button onClick={loginWithGoogle} className="nav-link-item" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--wire-glow)', fontSize: '0.85rem' }}>Login</button>
            )}

            <motion.button
              onClick={() => setIsCartOpen(true)}
              className="cart-trigger"
              animate={cartWiggle ? { rotate: [0, -12, 12, -12, 12, 0] } : {}}
              transition={{ duration: 0.5 }}
              aria-label="Open cart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {cart.length > 0 && (
                <span className="cart-badge-count">{cart.length}</span>
              )}
            </motion.button>

            <button
              className={`hamburger-btn ${mobileMenuOpen ? 'is-open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <span className="ham-line"></span>
              <span className="ham-line"></span>
              <span className="ham-line"></span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              className="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {NAV_LABELS.map((label, idx) => (
                <a
                  key={label}
                  href={label === 'Cart' ? '#' : NAV_HREFS[idx]}
                  className="mobile-nav-link"
                  onClick={(e) => {
                    if (label === 'Cart') {
                      e.preventDefault();
                      setIsCartOpen(true);
                    }
                    closeMobileMenu();
                  }}
                  style={{ '--link-color': NAV_ACCENT_COLORS[idx] }}
                >
                  <span className="mobile-nav-idx">0{idx + 1}</span>
                  {label}
                </a>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area via Router */}
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkout" element={
            <ProtectedRoute requireAuth>
              <Checkout />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute requireAuth>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAuth requireAdmin>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/category/:categoryId" element={<CategoryPage />} />
        </Routes>
      </AnimatePresence>

      <PlaylistToggle />
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onUpdateQuantity={handleUpdateQuantity}
      />
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <AppProvider>
      <Router>
        <AnimatePresence mode="wait">
          {isLoading && <Loader onComplete={() => setIsLoading(false)} />}
        </AnimatePresence>
        {!isLoading && <Layout />}
        <Analytics />
      </Router>
    </AppProvider>
  );
}
