import React, { useEffect, useState } from 'react';
import api from '../api';

/**
 * ProductReviews — compact inline review display for product cards.
 * Shows average star rating + review count.
 *
 * Props:
 *   productId: string
 *   count: number   — pass pre-fetched count to avoid extra API call
 */
export default function ProductReviews({ productId, count }) {
  const [reviewData, setReviewData] = useState(null);

  useEffect(() => {
    // Only fetch if count not provided
    if (count !== undefined) {
      setReviewData({ count, avgRating: null });
      return;
    }
    if (!productId) return;
    api.get(`/reviews/${productId}`)
      .then((res) => {
        const list = res.data?.list || [];
        const avg = list.length
          ? list.reduce((acc, r) => acc + r.rating, 0) / list.length
          : null;
        setReviewData({ count: res.data?.count || 0, avgRating: avg });
      })
      .catch(() => setReviewData({ count: 0, avgRating: null }));
  }, [productId, count]);

  if (!reviewData || reviewData.count === 0) return null;

  const stars = Math.round(reviewData.avgRating || 0);

  return (
    <div className="product-reviews-inline">
      <div className="product-stars-display">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={`inline-star ${s <= stars ? 'filled' : ''}`}>★</span>
        ))}
      </div>
      <span className="product-review-count">({reviewData.count})</span>
    </div>
  );
}
