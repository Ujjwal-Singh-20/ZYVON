import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../api';

import WireDivider from '../components/WireDivider';
import { useAppContext } from '../context/AppContext';
import LegalModal from '../components/LegalModal';

const HERO_TEXTS = ['FASHION', 'CLEAN FITS', 'PURE STYLE'];

export default function Home() {
  const { setGlowColor } = useAppContext();
  const [legalPage, setLegalPage] = useState(null); // 'terms' | 'privacy' | 'refund' | 'contact'
  const [heroIndex, setHeroIndex] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const heroRef = React.useRef(null);
  const teaRef = React.useRef(null);

  // Rotate hero text
  useEffect(() => {
    const timer = setInterval(() => setHeroIndex((i) => (i + 1) % HERO_TEXTS.length), 2800);
    return () => clearInterval(timer);
  }, []);

  // Fetch top-level categories
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Intersection observer for glow
  useEffect(() => {
    if (!setGlowColor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setGlowColor(e.target.dataset.glow || 'rgba(255,255,255,0.1)');
          }
        });
      },
      { root: null, rootMargin: '-30% 0px -30% 0px', threshold: 0 }
    );
    const sections = document.querySelectorAll('[data-glow]');
    sections.forEach((s) => observer.observe(s));
    return () => sections.forEach((s) => observer.unobserve(s));
  }, [setGlowColor, categories]);

  const getCategoryGlow = (idx) => {
    const glows = [
      'rgba(220,208,255,0.15)',
      'rgba(255,211,182,0.15)',
      'rgba(197,236,210,0.15)',
      'rgba(255,200,200,0.12)',
    ];
    return glows[idx % glows.length];
  };

  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <main className="main-content-scroll">

        {/* Hero Section */}
        <section className="hero-section" ref={heroRef} data-glow="rgba(255,255,255,0.08)">
          <div className="hero-text-container">
            <h1 className="hero-title">
              <span className="title-solid" style={{ fontFamily: 'var(--font-wireframe)' }}>FUTURE</span>
              <div className="title-outline-container">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={heroIndex}
                    className="title-outline"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  >
                    {HERO_TEXTS[heroIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </h1>
            <p className="hero-subtitle">
              DECONSTRUCTED TECHNICAL APPAREL. DESIGNED FOR THE NEXT WAVE.
            </p>
            <div className="hero-btn-wrapper">
              <div className="cta-wire-pulse-box">
                <svg className="btn-wire-svg" viewBox="0 0 180 60">
                  <rect className="btn-wire-rect" x="2" y="2" width="176" height="56" rx="28" />
                </svg>
                <a href="#collection" className="explore-btn">Cop the Drip</a>
              </div>
            </div>
          </div>
        </section>

        <WireDivider type="default" color="#dcd0ff" glowColor="rgba(220,208,255,0.3)" />

        {/* Category Grid */}
        <section id="collection" className="collection-section" data-glow="rgba(220,208,255,0.12)">
          <div className="section-header" style={{ padding: 0 }}>
            <div className="header-meta">
              <span className="marker-circle"></span>
              <span>COLLECTION // SHOP BY CATEGORY</span>
            </div>
            <h2 className="header-graffiti" style={{ fontFamily: 'var(--font-wireframe)' }}>
              THE DROPS
            </h2>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--wire-glow)', fontFamily: 'var(--font-wireframe)', letterSpacing: '4px' }}>
              LOADING CATALOG...
            </div>
          ) : categories.length === 0 ? (
            <div className="no-categories-placeholder">
              <div className="no-cat-icon">🏗</div>
              <p className="no-cat-title">DROPS INCOMING</p>
              <p className="no-cat-sub">New categories are being stocked. Check back soon.</p>
            </div>
          ) : (
            <motion.div
              className="category-hero-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
            >
              {categories.map((cat, idx) => (
                <motion.div
                  key={cat.categoryId}
                  className="category-card"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  data-glow={getCategoryGlow(idx)}
                >
                  <Link to={`/category/${cat.slug || cat.categoryId}`} className="category-card-link">
                    {cat.thumbnail ? (
                      <img src={cat.thumbnail} alt={cat.name} className="category-card-img" />
                    ) : (
                      <div className="category-card-img-placeholder" />
                    )}
                    <div className="category-card-overlay">
                      <div className="category-card-tag">CATEGORY</div>
                      <span className="category-card-name">{cat.name}</span>
                      <div className="category-card-meta-row">
                        {cat.children?.length > 0 && (
                          <span className="category-card-meta">{cat.children.length} sub-categories</span>
                        )}
                        {cat.products?.length > 0 && (
                          <span className="category-card-meta">{cat.products.length} items</span>
                        )}
                      </div>
                      <div className="category-card-cta">
                        <span>Browse</span>
                        <span>→</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        <WireDivider type="right-angle" color="#c5ecd2" glowColor="rgba(197,236,210,0.3)" />

        {/* The Tea Section */}
        <section id="tea" className="tea-section" ref={teaRef} data-glow="rgba(197,236,210,0.15)">
          <div className="section-header">
            <div className="header-meta">
              <span className="marker-plus">+</span>
              <span>COMMUNITY // FEEDBACK</span>
            </div>
            <h2 className="header-graffiti" style={{ fontFamily: 'var(--font-wireframe)' }}>THE TEA</h2>
          </div>
          <div className="testimonials-bubbles-grid">
            <div className="chat-bubble left" style={{ '--bubble-accent': '#dcd0ff' }}>
              <p className="bubble-msg">"Quality is solid, stitching feels durable. Worth the price."</p>
              <span className="bubble-author">@rahul.s // VERIFIED</span>
            </div>
            <div className="chat-bubble right" style={{ '--bubble-accent': '#ffd3b6' }}>
              <p className="bubble-msg">"Delivery was quick and packaging neat. Overall smooth experience."</p>
              <span className="bubble-author">@ananya.m // VERIFIED</span>
            </div>
            <div className="chat-bubble left" style={{ '--bubble-accent': '#c5ecd2' }}>
              <p className="bubble-msg">"Fit is comfortable, looks exactly like the pictures online."</p>
              <span className="bubble-author">@arjun.k // VERIFIED</span>
            </div>
            <div className="chat-bubble right" style={{ '--bubble-accent': '#ffe0cc' }}>
              <p className="bubble-msg">"Customer support helped me with size exchange easily. No hassle."</p>
              <span className="bubble-author">@priya.r // VERIFIED</span>
            </div>
          </div>
        </section>


        {/* Footer */}
        <footer id="contact" className="footer-section" data-glow="rgba(255,255,255,0.05)">
          <div className="footer-wire-horizontal"></div>
          <div className="footer-grid">

            {/* Brand */}
            <div className="footer-left">
              <h3 className="footer-logo">ZYVON.</h3>
              <p className="footer-desc">Streetwear crafted for those who move in silence.</p>
              <p style={{ fontSize: '12px', color: '#444', marginTop: '10px', lineHeight: '1.6' }}>
                All prices in Indian Rupees (INR).<br />
                Payments secured by Razorpay.
              </p>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-wireframe)', fontSize: '10px', letterSpacing: '3px', color: '#555', marginBottom: '4px' }}>NAVIGATE</span>
              <a href="#collection" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>Shop</a>
              <Link to="/dashboard" style={{ color: '#888', fontSize: '13px', textDecoration: 'none' }}>Dashboard</Link>
              <button onClick={() => setLegalPage('contact')} style={{ background: 'none', border: 'none', padding: 0, color: '#888', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Contact Us</button>
            </div>

            {/* Legal — Razorpay Compliance */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-wireframe)', fontSize: '10px', letterSpacing: '3px', color: '#555', marginBottom: '4px' }}>LEGAL</span>
              <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', padding: 0, color: '#888', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Terms &amp; Conditions</button>
              <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: '#888', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Privacy Policy</button>
              <button onClick={() => setLegalPage('refund')} style={{ background: 'none', border: 'none', padding: 0, color: '#888', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>Refund &amp; Cancellation</button>
            </div>

            {/* Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-wireframe)', fontSize: '10px', letterSpacing: '3px', color: '#555', marginBottom: '4px' }}>CONTACT</span>
              <a href="mailto:priyadarshih99@gmail.com" style={{ color: '#888', fontSize: '12px', textDecoration: 'none' }}>priyadarshih99@gmail.com</a>
              <a href="tel:+918278336549" style={{ color: '#888', fontSize: '12px', textDecoration: 'none' }}>+91 82783 36549</a>
              <span style={{ color: '#555', fontSize: '11px' }}>Mon–Sat · 10AM–6PM IST</span>
            </div>

          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: '1px solid #111', marginTop: '32px', paddingTop: '20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: '12px',
          }}>
            <span style={{ fontSize: '11px', color: '#333' }}>© {new Date().getFullYear()} ZYVON. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '20px' }}>
              <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', padding: 0, color: '#444', fontSize: '11px', cursor: 'pointer' }}>Terms</button>
              <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: '#444', fontSize: '11px', cursor: 'pointer' }}>Privacy</button>
              <button onClick={() => setLegalPage('refund')} style={{ background: 'none', border: 'none', padding: 0, color: '#444', fontSize: '11px', cursor: 'pointer' }}>Refunds</button>
            </div>
          </div>
        </footer>

        {/* Legal Modal */}
        {legalPage && <LegalModal pageKey={legalPage} onClose={() => setLegalPage(null)} />}

      </main>
    </motion.div>
  );
}
