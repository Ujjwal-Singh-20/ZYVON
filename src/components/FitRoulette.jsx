import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOPS = [
  { id: 't1', name: 'Oversized Hoodie', color: 'Lavender', hex: '#dcd0ff', price: 79 },
  { id: 't2', name: 'Tactical Utility Vest', color: 'Matte Black', hex: '#ffffff', price: 65 },
  { id: 't3', name: 'Deconstructed Cyber Jacket', color: 'Slate Grey', hex: '#c5ecd2', price: 110 }
];

const BOTTOMS = [
  { id: 'b1', name: 'Utility Cargo Pants', color: 'Mint Green', hex: '#c5ecd2', price: 85 },
  { id: 'b2', name: 'Matte Cargo Sweatpants', color: 'Off-White', hex: '#ffffff', price: 75 },
  { id: 'b3', name: 'Cyber Metal Jeans', color: 'Acid Wash Black', hex: '#dcd0ff', price: 95 }
];

const ACCESSORIES = [
  { id: 'a1', name: 'Ribbed Knit Beanie', color: 'Peach Accent', hex: '#ffd3b6', price: 28 },
  { id: 'a2', name: 'Silver Wire Chain Pin', color: 'Silver Chrome', hex: '#ffffff', price: 18 },
  { id: 'a3', name: 'Cyber Frame Eyewear', color: 'Neon Accent', hex: '#c5ecd2', price: 45 }
];

// Spinning refresh arrow — pure SVG, no lucide
const IconSpin = ({ spinning }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={spinning ? { animation: 'rotation 1s infinite linear' } : {}}
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);

// Checkmark — no lucide
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function FitRoulette({ onAddOutfit }) {
  const [spinning, setSpinning] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [added, setAdded] = useState(false);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setAdded(false);

    let count = 0;
    const interval = setInterval(() => {
      const tempTop = TOPS[Math.floor(Math.random() * TOPS.length)];
      const tempBottom = BOTTOMS[Math.floor(Math.random() * BOTTOMS.length)];
      const tempAcc = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
      setOutfit({ top: tempTop, bottom: tempBottom, accessory: tempAcc });
      count++;

      if (count > 15) {
        clearInterval(interval);
        const finalTop = TOPS[Math.floor(Math.random() * TOPS.length)];
        const finalBottom = BOTTOMS[Math.floor(Math.random() * BOTTOMS.length)];
        const finalAcc = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
        setOutfit({ top: finalTop, bottom: finalBottom, accessory: finalAcc });
        setSpinning(false);
      }
    }, 100);
  };

  const handleFlexIt = () => {
    if (!outfit) return;
    onAddOutfit([outfit.top, outfit.bottom, outfit.accessory]);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="fit-roulette-container">
      <div className="roulette-header">
        <h3 className="roulette-title">FIT ROULETTE</h3>
        <p className="roulette-subtitle">Generate a cohesive streetwear fit instantly.</p>
      </div>

      <div className="roulette-display-area">
        <AnimatePresence mode="wait">
          {outfit ? (
            <motion.div
              className="outfit-slots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key={outfit.top.id + outfit.bottom.id + outfit.accessory.id}
            >
              <div className="outfit-slot-card">
                <span className="slot-label">TOP</span>
                <span className="slot-name" style={{ color: outfit.top.hex }}>{outfit.top.name}</span>
                <span className="slot-detail">{outfit.top.color} &bull; ₹{outfit.top.price}</span>
              </div>
              <div className="slot-connector-wire">
                <div className="node"></div>
              </div>
              <div className="outfit-slot-card">
                <span className="slot-label">BOTTOM</span>
                <span className="slot-name" style={{ color: outfit.bottom.hex }}>{outfit.bottom.name}</span>
                <span className="slot-detail">{outfit.bottom.color} &bull; ₹{outfit.bottom.price}</span>
              </div>
              <div className="slot-connector-wire">
                <div className="node"></div>
              </div>
              <div className="outfit-slot-card">
                <span className="slot-label">ACCESSORY</span>
                <span className="slot-name" style={{ color: outfit.accessory.hex }}>{outfit.accessory.name}</span>
                <span className="slot-detail">{outfit.accessory.color} &bull; ₹{outfit.accessory.price}</span>
              </div>
            </motion.div>
          ) : (
            <div className="outfit-slots-empty">
              {/* Minimal pulsing diamond instead of Sparkles icon */}
              <svg className="pulsing-diamond" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1">
                <polygon points="12 2 22 12 12 22 2 12"/>
              </svg>
              <span>Ready to assemble.</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="roulette-actions">
        <div className="spin-btn-wrapper">
          <svg className="spin-wire-svg" viewBox="0 0 160 55" fill="none">
            <motion.rect
              x="2" y="2" width="156" height="51" rx="26"
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="10 30"
              animate={spinning ? { strokeDashoffset: [-100, 100] } : { strokeDashoffset: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
          </svg>
          <motion.button
            className={`spin-btn ${spinning ? 'is-spinning' : ''}`}
            onClick={handleSpin}
            disabled={spinning}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <IconSpin spinning={spinning} />
            <span>{spinning ? 'SPINNING...' : 'SPIN'}</span>
          </motion.button>
        </div>

        {outfit && (
          <motion.button
            className="flex-outfit-btn"
            onClick={handleFlexIt}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              borderColor: added ? '#c5ecd2' : 'rgba(255,255,255,0.15)',
              color: added ? '#c5ecd2' : '#ffffff'
            }}
          >
            {added ? <IconCheck /> : null}
            <span>{added ? 'ADDED TO CART' : 'FLEX THE FIT'}</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
