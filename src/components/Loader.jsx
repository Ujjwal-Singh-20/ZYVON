import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Loader({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 1500; // 1.5 seconds
    const intervalTime = 24;
    const increment = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 400);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="loader-container"
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] }
      }}
    >
      <div className="loader-content">
        {/* Futuristic Tech Grid Background */}
        <div className="loader-grid"></div>

        {/* Wireframe Building Itself Up */}
        <div className="wireframe-wrapper">
          <svg className="wireframe-svg" viewBox="0 0 200 200" fill="none">
            {/* Outer Tech Ring */}
            <motion.circle
              cx="100"
              cy="100"
              r="85"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="5 15"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
            />
            <motion.circle
              cx="100"
              cy="100"
              r="80"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.5"
              strokeDasharray="40 120"
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            />

            {/* Diamond Wireframe Structure */}
            {/* Outer Edges */}
            <motion.polygon
              points="100,20 40,90 100,170 160,90"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
              transition={{ ease: "easeInOut" }}
            />
            {/* Inner Vertices and Structure */}
            <motion.line
              x1="100" y1="20" x2="75" y2="95"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="100" y1="20" x2="125" y2="95"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="100" y1="170" x2="75" y2="95"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="100" y1="170" x2="125" y2="95"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            {/* Center Midline */}
            <motion.line
              x1="100" y1="20" x2="100" y2="170"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            {/* Belt lines */}
            <motion.line
              x1="40" y1="90" x2="75" y2="95"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="75" y1="95" x2="125" y2="95"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="125" y1="95" x2="160" y2="90"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.75"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />
            <motion.line
              x1="160" y1="90" x2="40" y2="90"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress / 100 }}
            />

            {/* Glowing nodes at intersections */}
            {progress > 50 && (
              <>
                <motion.circle cx="100" cy="20" r="2" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                <motion.circle cx="100" cy="170" r="2" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                <motion.circle cx="40" cy="90" r="1.5" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                <motion.circle cx="75" cy="95" r="1.5" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                <motion.circle cx="125" cy="95" r="1.5" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
                <motion.circle cx="160" cy="90" r="1.5" fill="#fff" initial={{ scale: 0 }} animate={{ scale: 1 }} />
              </>
            )}
          </svg>
        </div>

        {/* Brand & Loading Info */}
        <div className="loader-info">
          <motion.h2 
            className="loader-title"
            initial={{ letterSpacing: "8px", opacity: 0 }}
            animate={{ letterSpacing: "18px", opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            ZYVON
          </motion.h2>
          <div className="loader-percentage">
            {/* <span>SYSTEM INITIALIZATION</span> */}
            <span className="counter-num">{Math.floor(progress)}%</span>
          </div>
          <div className="loader-bar-bg">
            <motion.div 
              className="loader-bar-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
