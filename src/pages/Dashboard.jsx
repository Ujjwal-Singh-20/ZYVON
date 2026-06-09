import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import ReviewModal from '../components/ReviewModal';

const TIMELINE_STEPS = [
  { status: 'pending', label: 'Ordered' },
  { status: 'paid', label: 'Paid' },
  { status: 'completed', label: 'Delivered' },
];

const STATUS_COLORS = {
  active_online: '#dcd0ff',
  active_cod: '#ffd3b6',
  completed: '#c5ecd2',
  canceled: '#ff8888',
};

export default function Dashboard() {
  const { user, isAdmin, authLoading } = useAppContext();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [adminStats, setAdminStats] = useState(null);
  const [reviewedIds, setReviewedIds] = useState([]);

  const [adminOrders, setAdminOrders] = useState({ active: [], completed: [], canceled: [], returns: [] });
  const [adminOrderTab, setAdminOrderTab] = useState('active'); // active, completed, canceled, all
  const [loadingAdminOrders, setLoadingAdminOrders] = useState(false);

  const [cancelError, setCancelError] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [expandedAdminOrder, setExpandedAdminOrder] = useState(null);

  // Review state
  const [reviewPending, setReviewPending] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editReviewProduct, setEditReviewProduct] = useState(null);
  const [editReviewData, setEditReviewData] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const ordersRes = await api.get('/orders');
        setOrders(ordersRes.data);

        const userRes = await api.get('/users/me');
        const pending = userRes.data?.reviewPending;
        if (pending && pending.products && pending.products.length > 0) {
          setReviewPending(pending);
          setShowReviewModal(true);
        }

        setReviewedIds(userRes.data?.reviewedProductIds || []);

        if (userRes.data?.role === 'admin') {
          try {
            const statsRes = await api.get('/admin/dashboard/stats');
            setAdminStats(statsRes.data);
          } catch (_) { }

          // Fetch admin orders directly for the dashboard view
          try {
            setLoadingAdminOrders(true);
            const [activeRes, completedRes, canceledRes, returnsRes] = await Promise.all([
              api.get('/admin/orders/all'),
              api.get('/admin/orders/completed'),
              api.get('/admin/orders/canceled'),
              api.get('/admin/orders/returns')
            ]);
            setAdminOrders({
              active: activeRes.data,
              completed: completedRes.data,
              canceled: canceledRes.data,
              returns: returnsRes.data
            });
          } catch (_) { }
          finally { setLoadingAdminOrders(false); }
        }
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchData();
  }, [user]);

  const handleReviewComplete = () => {
    setShowReviewModal(false);
    setReviewPending(null);
    setEditReviewProduct(null);
    setEditReviewData(null);
    // Optionally refresh reviewed IDs here
  };

  const handleEditReview = async (product) => {
    setEditReviewProduct(product);
    try {
      const res = await api.get(`/reviews/${product.productId}/mine`);
      setEditReviewData(res.data);
    } catch (_) {
      setEditReviewData(null);
    }
    setShowReviewModal(true);
  };

  const handleRefund = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;
    setCancelError(null);
    try {
      const cancelRes = await api.post(`/orders/${orderId}/cancel`);
      alert(cancelRes.data.message);
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (err) {
      setCancelError(err.response?.data?.detail || err.message);
    }
  };

  const handleReturnRequest = async (orderId) => {
    if (!window.confirm("IMPORTANT: Please pack the item in its original packaging with all tags attached. We reserve the right to cancel the return request and not issue a refund if these conditions are not met. Do you agree to proceed with the return request?")) return;
    try {
      const res = await api.post(`/orders/${orderId}/return_request`);
      alert(res.data.message);
      const ordersRes = await api.get('/orders');
      setOrders(ordersRes.data);
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleMarkComplete = async (orderId) => {
    setCompletingId(orderId);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { new_status: 'completed' });
      // Refresh admin orders
      const [activeRes, completedRes, canceledRes, returnsRes] = await Promise.all([
        api.get('/admin/orders/all'),
        api.get('/admin/orders/completed'),
        api.get('/admin/orders/canceled'),
        api.get('/admin/orders/returns')
      ]);
      setAdminOrders({
        active: activeRes.data,
        completed: completedRes.data,
        canceled: canceledRes.data,
        returns: returnsRes.data
      });
    } catch (err) {
      console.error('Failed to mark complete:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleMarkCanceled = async (orderId) => {
    setCompletingId(orderId);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { new_status: 'canceled' });
      // Refresh admin orders
      const [activeRes, completedRes, canceledRes, returnsRes] = await Promise.all([
        api.get('/admin/orders/all'),
        api.get('/admin/orders/completed'),
        api.get('/admin/orders/canceled'),
        api.get('/admin/orders/returns')
      ]);
      setAdminOrders({
        active: activeRes.data,
        completed: completedRes.data,
        canceled: canceledRes.data,
        returns: returnsRes.data
      });
    } catch (err) {
      console.error('Failed to mark canceled:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleAcceptReturn = async (orderId) => {
    setCompletingId(orderId);
    try {
      await api.post(`/admin/orders/${orderId}/accept_return`);
      const [activeRes, completedRes, canceledRes, returnsRes] = await Promise.all([
        api.get('/admin/orders/all'),
        api.get('/admin/orders/completed'),
        api.get('/admin/orders/canceled'),
        api.get('/admin/orders/returns')
      ]);
      setAdminOrders({
        active: activeRes.data,
        completed: completedRes.data,
        canceled: canceledRes.data,
        returns: returnsRes.data
      });
      const statsRes = await api.get('/admin/dashboard/stats');
      setAdminStats(statsRes.data);
    } catch (err) {
      console.error('Failed to accept return:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleRejectReturn = async (orderId) => {
    if (!window.confirm("Are you sure you want to reject/cancel this return? The order will be marked back as delivered.")) return;
    setCompletingId(orderId);
    try {
      await api.post(`/admin/orders/${orderId}/reject_return`);
      const [activeRes, completedRes, canceledRes, returnsRes] = await Promise.all([
        api.get('/admin/orders/all'),
        api.get('/admin/orders/completed'),
        api.get('/admin/orders/canceled'),
        api.get('/admin/orders/returns')
      ]);
      setAdminOrders({
        active: activeRes.data,
        completed: completedRes.data,
        canceled: canceledRes.data,
        returns: returnsRes.data
      });
      const statsRes = await api.get('/admin/dashboard/stats');
      setAdminStats(statsRes.data);
    } catch (err) {
      console.error('Failed to reject return:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const renderTimeline = (paymentStatus, orderStatus) => {
    const isCanceled = paymentStatus === 'refunded' || orderStatus === 'canceled' || paymentStatus === 'failed';
    if (isCanceled) return <div style={{ color: '#ff4444', fontFamily: 'var(--font-wireframe)', letterSpacing: '2px', fontSize: '12px' }}>ORDER CANCELED / REFUNDED</div>;

    // 'completed' status (admin-confirmed delivery) maps to step 2
    // 'paid' maps to step 1 (payment received, awaiting delivery)
    const statusMap = { pending: 0, paid: 1, completed: 2, delivered: 2 };
    const currentIndex = statusMap[orderStatus] ?? statusMap[paymentStatus] ?? 0;

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginTop: '20px' }}>
        <div style={{ position: 'absolute', top: '20px', left: '10%', right: '10%', height: '2px', background: '#1a1a1a', zIndex: 1 }}></div>
        <div style={{ position: 'absolute', top: '20px', left: '10%', width: `${(Math.max(0, currentIndex) / 2) * 80}%`, height: '2px', background: 'var(--wire-glow)', zIndex: 1, transition: 'width 0.5s' }}></div>
        {TIMELINE_STEPS.map((step, idx) => {
          const isActive = idx <= currentIndex;
          return (
            <div key={step.status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, width: '60px' }}>
              <div style={{ width: '40px', height: '40px', background: isActive ? '#111' : '#000', border: `2px solid ${isActive ? 'var(--wire-glow)' : '#222'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isActive ? '0 0 10px rgba(220,208,255,0.2)' : 'none', transition: 'all 0.3s' }}>
                <span style={{ fontSize: '18px' }}>{idx === 0 ? '📋' : idx === 1 ? '💳' : '📦'}</span>
              </div>
              <span style={{ fontSize: '10px', marginTop: '8px', color: isActive ? '#fff' : '#444', textTransform: 'uppercase', letterSpacing: '1px' }}>{step.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (authLoading || !user) {
    return <div style={{ color: 'var(--wire-glow)', padding: '120px', textAlign: 'center', fontFamily: 'var(--font-wireframe)', letterSpacing: '4px' }}>LOADING AUTH...</div>;
  }

  return (
    <>
      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <ReviewModal
            pendingProducts={editReviewProduct ? undefined : reviewPending?.products}
            editProduct={editReviewProduct}
            existingReview={editReviewData}
            onComplete={handleReviewComplete}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="page-wrapper"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ paddingTop: '100px', minHeight: '100vh', color: '#fff' }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #1a1a1a', paddingBottom: '20px', marginBottom: '40px' }}>
            <div>
              <p style={{ color: '#555', fontFamily: 'var(--font-wireframe)', fontSize: '11px', letterSpacing: '3px', marginBottom: '6px' }}>LOGGED IN AS</p>
              <p style={{ color: '#555', fontSize: '13px', marginTop: '4px' }}>{user.email}</p>
              <h1 style={{ fontFamily: 'var(--font-wireframe)', color: 'var(--wire-glow)', letterSpacing: '4px', margin: 0 }}>{isAdmin ? 'ADMIN DASHBOARD' : 'YOUR FITS'}</h1>
            </div>
            {isAdmin && (
              <Link
                to="/admin"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#ffffff', color: '#000000',
                  padding: '10px 20px', borderRadius: '6px',
                  fontFamily: 'var(--font-wireframe)', fontSize: '12px',
                  letterSpacing: '2px', textDecoration: 'none',
                  fontWeight: 800, transition: 'all 0.2s',
                  boxShadow: '0 0 15px rgba(255,255,255,0.2)'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                ⚙ OPEN ADMIN PANEL
              </Link>
            )}
          </div>

          {/* ── ADMIN: Stats + Orders Section ── */}
          {isAdmin && adminStats && (
            <div style={{ marginBottom: '48px' }}>

              {/* Section Title */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '16px',
              }}>
                <p style={{ fontFamily: 'var(--font-wireframe)', letterSpacing: '3px', fontSize: '12px', color: '#666' }}>STORE OVERVIEW</p>
              </div>

              {/* Stats Row */}
              <motion.div className="admin-stats-panel" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <span className="stat-num">{(adminStats.orders?.active_online || 0) + (adminStats.orders?.active_cod || 0)}</span>
                    <span className="stat-label">Active Orders</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num">{adminStats.orders?.completed || 0}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num">{adminStats.orders?.canceled || 0}</span>
                    <span className="stat-label">Cancelled</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num">₹{adminStats.revenue?.total_inr?.toLocaleString() || 0}</span>
                    <span className="stat-label">Revenue</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num" style={{color: '#ff8888'}}>₹{adminStats.revenue?.total_refunded_inr?.toLocaleString() || 0}</span>
                    <span className="stat-label">Refunded</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num">{adminStats.users || 0}</span>
                    <span className="stat-label">Users</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="stat-num">{adminStats.active_products || 0}</span>
                    <span className="stat-label">Products</span>
                  </div>
                </div>
              </motion.div>

              {/* Admin Orders Table */}
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontFamily: 'var(--font-wireframe)', letterSpacing: '3px', fontSize: '12px', color: '#666' }}>STORE ORDERS</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['active', 'completed', 'canceled', 'returns', 'all'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setAdminOrderTab(tab)}
                      style={{
                        background: adminOrderTab === tab ? '#222' : 'transparent',
                        color: adminOrderTab === tab ? '#fff' : '#666',
                        border: '1px solid #222', padding: '4px 12px', borderRadius: '4px',
                        fontSize: '11px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                        cursor: 'pointer'
                      }}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {loadingAdminOrders ? (
                <div style={{ color: '#444', fontFamily: 'var(--font-wireframe)', letterSpacing: '2px', fontSize: '11px' }}>LOADING ORDERS...</div>
              ) : (() => {
                let displayedOrders = [];
                if (adminOrderTab === 'all') {
                  const all = [...adminOrders.active, ...adminOrders.completed, ...adminOrders.canceled, ...adminOrders.returns];
                  const uniqueOrders = [];
                  const seen = new Set();
                  for (const o of all) {
                    const oid = o.orderId || o.id;
                    if (!seen.has(oid)) {
                      seen.add(oid);
                      uniqueOrders.push(o);
                    }
                  }
                  displayedOrders = uniqueOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                } else {
                  displayedOrders = adminOrders[adminOrderTab] || [];
                }

                if (displayedOrders.length === 0) {
                  return <div style={{ color: '#333', fontSize: '13px', padding: '24px', border: '1px dashed #1a1a1a', borderRadius: '8px', textAlign: 'center' }}>No {adminOrderTab} orders.</div>;
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {displayedOrders.map((order) => {
                      const statusKey = order.paymentType === 'online' ? 'active_online' : order.paymentType === 'cod' ? 'active_cod' : order.paymentStatus;
                      const accentColor = STATUS_COLORS[statusKey] || STATUS_COLORS[order.paymentStatus] || '#666';
                      const isAlreadyDone = order.paymentStatus === 'completed' || order.paymentStatus === 'refunded' || order.paymentStatus === 'failed';
                      const orderId = order.orderId || order.id;
                      return (
                        <motion.div
                          key={orderId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          style={{
                            background: '#080808',
                            border: `1px solid ${accentColor}22`,
                            borderLeft: `3px solid ${accentColor}`,
                            borderRadius: '8px', overflow: 'hidden',
                          }}
                        >
                          {/* Summary row */}
                          <div style={{
                            padding: '14px 20px', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer',
                          }}
                            onClick={() => setExpandedAdminOrder(prev => prev === orderId ? null : orderId)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: `${accentColor}20`, color: accentColor, fontFamily: 'var(--font-wireframe)', letterSpacing: '1px' }}>
                                {order.paymentType?.toUpperCase()} · {order.paymentStatus?.toUpperCase()}
                              </span>
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#555' }}>{orderId?.substring(0, 22)}...</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ color: '#aaa', fontSize: '13px' }}>₹{parseFloat(order.grandTotal || 0).toFixed(2)}</span>
                              <span style={{ color: '#444', fontSize: '12px' }}>{expandedAdminOrder === orderId ? '▲' : '▼'}</span>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          <AnimatePresence>
                            {expandedAdminOrder === orderId && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ borderTop: `1px solid ${accentColor}22`, overflow: 'hidden' }}
                              >
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#888' }}>
                                  <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#555', minWidth: '110px' }}>Order ID</span><span style={{ fontFamily: 'monospace', color: '#aaa' }}>{orderId}</span></div>
                                  <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#555', minWidth: '110px' }}>User ID</span><span style={{ fontFamily: 'monospace', color: '#aaa' }}>{order.userId}</span></div>
                                  <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#555', minWidth: '110px' }}>Items</span><span style={{ color: '#ccc' }}>{order.products?.length || 0} item(s)</span></div>
                                  {order.shippingAddress && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <span style={{ color: '#555', minWidth: '110px' }}>Ship To</span>
                                      <span style={{ color: '#aaa' }}>{order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</span>
                                    </div>
                                  )}
                                  <div style={{ marginTop: '6px' }}>
                                    {(order.products || []).map((p, i) => (
                                      <div key={i} style={{ display: 'flex', gap: '16px', padding: '6px 0', borderBottom: '1px solid #111', alignItems: 'center' }}>
                                        {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />}
                                        <span style={{ color: '#ccc', flex: 1 }}>{p.name || p.productId?.substring(0, 16)}</span>
                                        <span>Size: {p.size}</span>
                                        <span>×{p.quantity}</span>
                                        <span style={{ color: 'var(--wire-glow)' }}>₹{p.price}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {adminOrderTab === 'returns' || order.returnStatus === 'requested' ? (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                      <button
                                        onClick={() => handleAcceptReturn(orderId)}
                                        disabled={completingId === orderId}
                                        style={{
                                          background: 'rgba(197,236,210,0.08)', border: '1px solid rgba(197,236,210,0.25)',
                                          color: '#c5ecd2', padding: '8px 18px', borderRadius: '4px',
                                          cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                          opacity: completingId === orderId ? 0.5 : 1,
                                        }}
                                      >
                                        ✓ ACCEPT RETURN
                                      </button>
                                      <button
                                        onClick={() => handleRejectReturn(orderId)}
                                        disabled={completingId === orderId}
                                        style={{
                                          background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
                                          color: '#ff8888', padding: '8px 18px', borderRadius: '4px',
                                          cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                          opacity: completingId === orderId ? 0.5 : 1,
                                        }}
                                      >
                                        ✗ REJECT
                                      </button>
                                    </div>
                                  ) : adminOrderTab === 'canceled' || order.status === 'canceled' || order.status === 'returned' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', alignSelf: 'flex-start' }}>
                                      <button
                                        onClick={() => handleMarkCanceled(orderId)}
                                        disabled={order.cancelAcknowledged || completingId === orderId}
                                        style={{
                                          background: order.cancelAcknowledged ? 'transparent' : 'rgba(255,68,68,0.08)',
                                          border: '1px solid rgba(255,68,68,0.25)',
                                          color: '#ff8888', padding: '8px 18px', borderRadius: '4px',
                                          cursor: order.cancelAcknowledged ? 'default' : 'pointer', fontSize: '11px',
                                          fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                          opacity: (order.cancelAcknowledged || completingId === orderId) ? 0.6 : 1,
                                        }}
                                      >
                                        {completingId === orderId ? '...' : order.cancelAcknowledged ? '✓ CANCELED & EMAILED' : '✓ CONFIRM CANCELED/REFUNDED'}
                                      </button>
                                      <button
                                        onClick={() => handleRejectReturn(orderId)}
                                        disabled={completingId === orderId}
                                        style={{
                                          background: 'transparent', border: '1px solid #444',
                                          color: '#888', padding: '6px 12px', borderRadius: '4px',
                                          cursor: 'pointer', fontSize: '10px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                          opacity: completingId === orderId ? 0.5 : 1, alignSelf: 'flex-start'
                                        }}
                                      >
                                        ✗ REVERT TO DELIVERED (REJECT RETURN)
                                      </button>
                                    </div>
                                  ) : isAlreadyDone ? (
                                    <button
                                      disabled
                                      style={{
                                        marginTop: '8px', alignSelf: 'flex-start',
                                        background: 'transparent', border: '1px solid rgba(197,236,210,0.25)',
                                        color: '#c5ecd2', padding: '8px 18px', borderRadius: '4px',
                                        fontSize: '11px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                        opacity: 0.6, cursor: 'default'
                                      }}
                                    >
                                      {order.paymentStatus === 'refunded' || order.paymentStatus === 'failed' || order.status === 'canceled' ? 'CANCELED' : '✓ DELIVERED'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleMarkComplete(orderId)}
                                      disabled={completingId === orderId}
                                      style={{
                                        marginTop: '8px', alignSelf: 'flex-start',
                                        background: 'rgba(197,236,210,0.08)', border: '1px solid rgba(197,236,210,0.25)',
                                        color: '#c5ecd2', padding: '8px 18px', borderRadius: '4px',
                                        cursor: 'pointer', fontSize: '11px',
                                        fontFamily: 'var(--font-wireframe)', letterSpacing: '1px',
                                        opacity: completingId === orderId ? 0.5 : 1,
                                      }}
                                    >
                                      {completingId === orderId ? '...' : '✓ MARK AS DELIVERED'}
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Pending Reviews Banner */}
          {reviewPending && !showReviewModal && (
            <motion.div
              className="review-pending-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowReviewModal(true)}
            >
              <span>⭐ You have {reviewPending.products.length} review{reviewPending.products.length > 1 ? 's' : ''} pending — drop your thoughts!</span>
              <button className="review-banner-btn">Rate Now</button>
            </motion.div>
          )}

          {/* Cancel error inline message */}
          <AnimatePresence>
            {cancelError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff8888', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>⚠ {cancelError}</span>
                <button onClick={() => setCancelError(null)} style={{ background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* My Orders heading — only show for non-admin OR show as secondary section for admin */}
          {!isAdmin && (
            <div style={{ marginBottom: '16px', fontFamily: 'var(--font-wireframe)', letterSpacing: '3px', fontSize: '12px', color: '#666' }}>MY ORDERS</div>
          )}
          {isAdmin && orders.length > 0 && (
            <div style={{ marginBottom: '16px', fontFamily: 'var(--font-wireframe)', letterSpacing: '3px', fontSize: '12px', color: '#444' }}>MY PERSONAL ORDERS</div>
          )}

          {/* User Orders List */}
          {loadingOrders ? (
            <div style={{ color: 'var(--wire-glow)', fontFamily: 'var(--font-wireframe)', letterSpacing: '3px' }}>FETCHING ORDERS...</div>
          ) : orders.length === 0 ? (
            !isAdmin && <p style={{ color: '#444' }}>No orders found. Start shopping →</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {orders.map((order) => {
                const orderDate = new Date(order.date || order.createdAt);
                const hoursSinceOrder = (new Date() - orderDate) / (1000 * 60 * 60);
                const isCanceled = order.paymentStatus === 'refunded' || order.status === 'canceled' || order.status === 'returned' || order.paymentStatus === 'failed';
                const canCancel = hoursSinceOrder < 24 && !isCanceled && order.status !== 'completed';
                // ONLY show DELIVERED when admin explicitly marks it completed (order.status === 'completed')
                // 'paid' just means payment received — NOT delivered yet
                const isCompleted = order.status === 'completed';

                let returnButton = null;
                if (isCompleted && !isCanceled) {
                  const lastUpdate = new Date(order.updatedAt || order.createdAt);
                  const daysSinceDelivery = (new Date() - lastUpdate) / (1000 * 60 * 60 * 24);
                  const withinReturnWindow = daysSinceDelivery <= 7;
                  
                  if (order.returnStatus === 'requested') {
                    returnButton = <span style={{ color: '#ffb347', fontSize: '12px' }}>RETURN PENDING APPROVAL</span>;
                  } else if (order.returnStatus === 'accepted') {
                    returnButton = <span style={{ color: '#c5ecd2', fontSize: '12px' }}>RETURN ACCEPTED</span>;
                  } else if (order.returnStatus === 'rejected') {
                    returnButton = <span style={{ color: '#ff4444', fontSize: '12px' }}>RETURN REJECTED</span>;
                  } else if (withinReturnWindow) {
                    returnButton = (
                      <button onClick={() => handleReturnRequest(order.id || order.orderId)} style={{ background: '#111', border: '1px solid #333', color: '#888', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        REQUEST RETURN
                      </button>
                    );
                  }
                }

                return (
                  <motion.div
                    key={order.id || order.orderId}
                    className="dashboard-order-card"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #1a1a1a', paddingBottom: '14px', marginBottom: '20px' }}>
                      <div>
                        <span style={{ color: '#444', fontSize: '11px', display: 'block', letterSpacing: '2px' }}>ORDER ID</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#aaa' }}>{(order.id || order.orderId)?.substring(0, 24)}...</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#444', fontSize: '11px', display: 'block', letterSpacing: '2px' }}>TOTAL</span>
                        <span style={{ fontSize: '15px', color: 'var(--wire-glow)' }}>₹{parseFloat(order.grandTotal || order.total || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Order Products List */}
                    <div style={{ marginBottom: '20px', padding: '0 10px' }}>
                      {(order.products || []).map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: '13px', alignItems: 'center' }}>
                          {p.imageUrl && <img src={p.imageUrl} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />}
                          <span style={{ color: '#ccc', flex: 1 }}>{p.name || p.productId?.substring(0, 16)}</span>
                          <span style={{ color: '#888' }}>Size: {p.size}</span>
                          <span style={{ color: '#888' }}>×{p.quantity}</span>
                          <span style={{ color: '#aaa' }}>₹{p.price}</span>
                        </div>
                      ))}
                    </div>

                    {renderTimeline(order.paymentStatus, order.status)}

                    <div style={{ marginTop: '24px', borderTop: '1px solid #111', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      {isCanceled ? (
                        <span style={{ color: '#ff4444', fontSize: '12px' }}>Order Canceled / Returned / Refunded</span>
                      ) : canCancel ? (
                        <button onClick={() => handleRefund(order.id || order.orderId)} style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          CANCEL ORDER
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          {isCompleted && <span style={{ color: '#c5ecd2', fontSize: '12px', fontFamily: 'var(--font-wireframe)', letterSpacing: '1px' }}>✓ DELIVERED</span>}
                          {returnButton}
                        </div>
                      )}

                      {isCompleted && !isCanceled && (order.products || []).length > 0 && (
                        (() => {
                          const firstProduct = (order.products || [])[0];
                          if (!firstProduct) return null;
                          const isReviewed = reviewedIds.includes(firstProduct.productId);

                          return (
                            <button
                              className="rate-drop-btn"
                              onClick={() => handleEditReview({
                                productId: firstProduct.productId,
                                name: firstProduct.name || 'Product',
                                imageUrl: '',
                              })}
                            >
                              {isReviewed ? '⭐ Edit Review' : '⭐ Rate Product'}
                            </button>
                          );
                        })()
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
