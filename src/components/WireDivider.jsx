import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function WireDivider({ color = '#dcd0ff', glowColor = 'rgba(220, 208, 255, 0.4)', type = 'default' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const pathLength = useTransform(scrollYProgress, [0.1, 0.7], [0, 1]);

  // Different decorative paths for variety
  const getPathData = () => {
    switch (type) {
      case 'left-angle':
        return "M 0 10 L 200 10 L 220 30 L 400 30 L 415 15 L 430 15 L 450 30 L 1000 30";
      case 'right-angle':
        return "M 0 30 L 550 30 L 570 10 L 590 10 L 610 30 L 800 30 L 820 10 L 1000 10";
      case 'zig-zag':
        return "M 0 20 L 420 20 L 440 10 L 460 30 L 480 10 L 500 30 L 520 20 L 1000 20";
      default:
        return "M 0 20 L 450 20 L 470 10 L 500 30 L 530 10 L 550 20 L 1000 20";
    }
  };


  const pathData = getPathData();

  return (
    <div ref={ref} className="wire-divider">
      <svg width="100%" height="40" viewBox="0 0 1000 40" fill="none" preserveAspectRatio="none">
        {/* Background inactive wire path */}
        <path
          d={pathData}
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="1"
        />
        {/* Glowing animated wire path */}
        <motion.path
          d={pathData}
          stroke={color}
          strokeWidth="1.2"
          style={{ pathLength }}
          filter={`drop-shadow(0 0 4px ${glowColor})`}
        />

      </svg>
    </div>
  );
}
