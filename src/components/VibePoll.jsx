import React from 'react';
import { motion } from 'framer-motion';

const VIBES = [
  { id: 'chill', label: 'CHILL', color: '#dcd0ff', bg: 'rgba(220, 208, 255, 0.05)' },
  { id: 'extra', label: 'EXTRA', color: '#ffd3b6', bg: 'rgba(255, 211, 182, 0.05)' },
  { id: 'goth', label: 'GOTH', color: '#c5ecd2', bg: 'rgba(197, 236, 210, 0.05)' }
];

export default function VibePoll({ selectedVibe, onSelectVibe }) {
  return (
    <div className="vibe-poll-container">
      <div className="vibe-header-wrapper">
        <div className="geometric-plus">+</div>
        <h3 className="vibe-heading">WHAT'S TODAY'S VIBE?</h3>
        <div className="geometric-plus">+</div>
      </div>

      <div className="vibe-buttons-grid">
        {VIBES.map((vibe) => {
          const isActive = selectedVibe === vibe.id;
          return (
            <motion.button
              key={vibe.id}
              onClick={() => onSelectVibe(vibe.id)}
              className={`vibe-btn ${isActive ? 'is-active' : ''}`}
              style={{
                '--vibe-color': vibe.color,
                '--vibe-bg': vibe.bg
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Outer dynamic wire path */}
              {isActive && (
                <svg className="vibe-btn-wire" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <motion.rect
                    x="1" y="1" width="98" height="98" rx="6"
                    stroke={vibe.color}
                    strokeWidth="1.5"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </svg>
              )}

              <span className="vibe-btn-dot" style={{ background: vibe.color }}></span>
              <span className="vibe-btn-text">{vibe.label}</span>
              
              {/* Minimal geometric corner detail */}
              <div className="vibe-btn-corner"></div>
            </motion.button>
          );
        })}
      </div>

      <div className="vibe-indicator">
        {selectedVibe ? (
          <motion.p 
            className="vibe-subtext"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            key={selectedVibe}
          >
            {selectedVibe === 'chill' && 'Curating oversized fits and muted pastels. Maximum comfort.'}
            {selectedVibe === 'extra' && 'Loud silhouettes and peach contrast highlights. Zero skips.'}
            {selectedVibe === 'goth' && 'Deconstructed dark outlines with silver wire accents. Pure shadow.'}
          </motion.p>
        ) : (
          <p className="vibe-subtext-empty">Select a state to filter your feed.</p>
        )}
      </div>
    </div>
  );
}
