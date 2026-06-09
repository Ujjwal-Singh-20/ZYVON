import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

/**
 * ReviewModal — Gen-Z styled review modal.
 * Shows sequentially for each product in `pendingProducts`.
 * Also supports edit mode when opened from Dashboard's "Rate This Drop" button.
 *
 * Props:
 *   pendingProducts: [{ productId, name, imageUrl }]
 *   onComplete: () => void   — called when all reviews done / dismissed
 *   editProduct: { productId, name, imageUrl } | null   — for editing a single review
 *   existingReview: { rating, text } | null              — prefill when editing
 */
export default function ReviewModal({
  pendingProducts = [],
  onComplete,
  editProduct = null,
  existingReview = null,
}) {
  const products = editProduct ? [editProduct] : pendingProducts;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState(existingReview?.text || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const current = products[currentIdx];
  const isEdit = !!editProduct || !!existingReview;
  const isLast = currentIdx >= products.length - 1;
  const total = products.length;

  const resetForNext = () => {
    setRating(0);
    setHoverRating(0);
    setText('');
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await api.post(`/reviews/${current.productId}`, { rating, text });
      setSubmitted(true);
      setTimeout(() => {
        if (isLast) {
          onComplete?.();
        } else {
          setCurrentIdx((i) => i + 1);
          resetForNext();
        }
      }, 1200);
    } catch (err) {
      console.error('Review submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (isLast) {
      onComplete?.();
    } else {
      setCurrentIdx((i) => i + 1);
      resetForNext();
    }
  };

  if (!current) return null;

  const starLabels = ['', 'Not it 😐', 'Mid 😑', 'Solid 🔥', 'Fire 💯', 'Absolute perfection 👑'];

  return (
    <AnimatePresence>
      <motion.div
        className="review-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="review-modal"
          initial={{ y: 60, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          key={currentIdx}
        >
          {/* Header */}
          <div className="review-modal-header">
            <div className="review-modal-tag">REVIEW REQUEST</div>
            {total > 1 && (
              <span className="review-modal-progress">{currentIdx + 1} of {total}</span>
            )}
          </div>

          {/* Product info */}
          <div className="review-product-row">
            {current.imageUrl && (
              <div className="review-product-img-wrap">
                <img src={current.imageUrl} alt={current.name} className="review-product-img" />
              </div>
            )}
            <div className="review-product-info">
              <span className="review-product-label">You bought</span>
              <span className="review-product-name">{current.name}</span>
            </div>
          </div>

          {/* Success state */}
          {submitted ? (
            <motion.div
              className="review-success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="review-success-emoji">✨</span>
              <p>Review submitted, thanks!</p>
            </motion.div>
          ) : (
            <>
              {/* Star Rating */}
              <div className="review-stars-section">
                <p className="review-stars-label">rate the fit</p>
                <div className="review-stars-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`review-star-btn ${(hoverRating || rating) >= star ? 'active' : ''}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      aria-label={`${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {(hoverRating || rating) > 0 && (
                  <motion.span
                    className="review-star-label"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={hoverRating || rating}
                  >
                    {starLabels[hoverRating || rating]}
                  </motion.span>
                )}
              </div>

              {/* Text area */}
              <div className="review-text-section">
                <textarea
                  className="review-textarea"
                  placeholder="Drop your thoughts 👀 (optional)"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 280))}
                  rows={3}
                />
                <span className="review-char-count">{text.length}/280</span>
              </div>

              {/* Actions */}
              <div className="review-actions">
                <button className="review-skip-btn" onClick={handleSkip}>
                  {isLast ? 'Skip 🙅' : 'Skip this one'}
                </button>
                <button
                  className="review-submit-btn"
                  onClick={handleSubmit}
                  disabled={!rating || submitting}
                >
                  {submitting
                    ? 'Posting...'
                    : isEdit
                    ? 'Update Review ✏️'
                    : 'Post Review 🔥'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
