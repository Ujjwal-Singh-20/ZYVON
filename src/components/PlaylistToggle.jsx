import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TRACKS = [
  { id: 'lofi', name: 'LOFI CHILL', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', color: '#dcd0ff' },
  { id: 'hyperpop', name: 'HYPERPOP GLITCH', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', color: '#c5ecd2' },
  { id: 'trap', name: 'TRAP DRIP', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', color: '#ffd3b6' }
];

// Minimal inline SVGs — no lucide
const IconPlay = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IconPause = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const IconSkip = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 4 15 12 5 20 5 4"/>
    <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconVolume = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
  </svg>
);
const IconMute = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);
// Musical note mark for the trigger when idle
const IconNote = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);

export default function PlaylistToggle() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showControls, setShowControls] = useState(false);

  const audioRef = useRef(null);
  const currentTrack = TRACKS[currentTrackIndex];

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [currentTrackIndex]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Audio blocked:', err));
    }
  };

  const handleSkip = () => setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);

  const handleMuteToggle = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="playlist-container">
      <audio ref={audioRef} loop onEnded={handleSkip} />

      <AnimatePresence>
        {showControls && (
          <motion.div
            className="playlist-expanded"
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          >
            <div className="playlist-wire-frame"></div>

            <div className="playlist-track-info">
              <span className="playlist-genre-tag" style={{ color: currentTrack.color }}>
                {currentTrack.name}
              </span>
              <span className="playlist-status">
                {isPlaying ? 'ON AIR' : 'PAUSED'}
              </span>
            </div>

            <div className="playlist-controls">
              <button onClick={handlePlayPause} className="playlist-btn" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>
              <button onClick={handleSkip} className="playlist-btn" title="Next Track">
                <IconSkip />
              </button>
              <button onClick={handleMuteToggle} className="playlist-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <IconMute /> : <IconVolume />}
              </button>
            </div>

            <div className="playlist-volume-bar">
              <input
                type="range" min="0" max="1" step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="playlist-range"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger */}
      <motion.button
        className={`playlist-trigger ${isPlaying ? 'is-active' : ''}`}
        onClick={() => setShowControls(!showControls)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{ borderColor: showControls ? currentTrack.color : 'rgba(255, 255, 255, 0.15)' }}
      >
        {isPlaying ? (
          <div className="soundwave-bars">
            <span className="bar" style={{ background: currentTrack.color }}></span>
            <span className="bar" style={{ background: currentTrack.color }}></span>
            <span className="bar" style={{ background: currentTrack.color }}></span>
          </div>
        ) : (
          <IconNote />
        )}
      </motion.button>
    </div>
  );
}
