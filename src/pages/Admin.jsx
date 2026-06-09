import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import AdminCategoryTree from '../components/AdminCategoryTree';

const STATUS_COLORS = {
  online: '#dcd0ff',
  cod: '#ffd3b6',
  completed: '#c5ecd2',
  canceled: '#ff8888',
};

// ─── Stock Manager sub-component ─────────────────────────────────────────────
function StockManager() {
  const [productIds, setProductIds] = useState(['']); // array of product ID strings
  const [products, setProducts] = useState({});       // { [id]: productData }
  const [loadingIds, setLoadingIds] = useState({});   // { [id]: bool }
  const [stockEdits, setStockEdits] = useState({});   // { [id:size]: newValue }
  const [savingKey, setSavingKey] = useState(null);

  const fetchProduct = async (id, idx) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoadingIds(prev => ({ ...prev, [idx]: true }));
    try {
      const res = await api.get(`/products/${trimmed}`);
      setProducts(prev => ({ ...prev, [trimmed]: res.data }));
    } catch {
      setProducts(prev => ({ ...prev, [trimmed]: null }));
    } finally {
      setLoadingIds(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleIdChange = (idx, val) => {
    setProductIds(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    // debounce-ish: fetch on blur instead
  };

  const addRow = () => setProductIds(prev => [...prev, '']);
  const removeRow = (idx) => {
    const removedId = productIds[idx]?.trim();
    setProductIds(prev => prev.filter((_, i) => i !== idx));
    if (removedId) {
      setProducts(prev => { const n = { ...prev }; delete n[removedId]; return n; });
    }
  };

  const handleStockChange = (productId, size, val) => {
    setStockEdits(prev => ({ ...prev, [`${productId}:${size}`]: val }));
  };

  const handleSaveStock = async (productId, size) => {
    const key = `${productId}:${size}`;
    const val = parseInt(stockEdits[key], 10);
    if (isNaN(val) || val < 0) return alert('Enter a valid non-negative stock number.');
    setSavingKey(key);
    try {
      const res = await api.patch(`/admin/products/${productId}/stock`, { size, new_stock: val });
      alert(res.data.message);
      // Refresh product data
      const refreshed = await api.get(`/products/${productId}`);
      setProducts(prev => ({ ...prev, [productId]: refreshed.data }));
      setStockEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: '6px', color: '#aaa', letterSpacing: '2px', fontSize: '14px' }}>
        STOCK MANAGER
      </h3>
      <p style={{ fontSize: '12px', color: '#555', marginBottom: '24px' }}>
        Enter product IDs below. Each one will fetch a live thumbnail + current stock so you can adjust per-size.
      </p>

      {/* Product ID rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {productIds.map((id, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              className="admin-input"
              placeholder={`Product ID #${idx + 1}`}
              value={id}
              onChange={e => handleIdChange(idx, e.target.value)}
              onBlur={() => fetchProduct(id, idx)}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
            />
            {loadingIds[idx] && (
              <span style={{ fontSize: '11px', color: '#555' }}>fetching...</span>
            )}
            {productIds.length > 1 && (
              <button
                onClick={() => removeRow(idx)}
                style={{
                  background: 'none', border: '1px solid #ff444433', color: '#ff4444',
                  width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                }}
              >✕</button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        style={{
          background: 'none', border: '1px dashed #333', color: '#666',
          padding: '8px 18px', borderRadius: '6px', cursor: 'pointer',
          fontSize: '12px', letterSpacing: '1px', marginBottom: '32px',
        }}
      >
        + ADD ANOTHER PRODUCT
      </button>

      {/* Product cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {productIds.map((rawId) => {
          const id = rawId.trim();
          if (!id) return null;
          const product = products[id];
          if (product === undefined) return null; // not fetched yet

          if (product === null) {
            return (
              <div key={id} style={{
                background: '#0e0e0e', border: '1px solid #ff444433',
                borderRadius: '10px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{ color: '#ff4444', fontSize: '12px' }}>
                  ✕ Product not found: <code style={{ color: '#aaa' }}>{id}</code>
                </span>
              </div>
            );
          }

          const imageUrl = (product.images || [])[0];
          const sizes = product.sizes || {};

          return (
            <div key={id} style={{
              background: '#0e0e0e', border: '1px solid #1e1e1e',
              borderRadius: '10px', overflow: 'hidden',
            }}>
              {/* Header row: thumbnail + name */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px 20px', borderBottom: '1px solid #1a1a1a',
              }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.name}
                    style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #222' }}
                  />
                ) : (
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '6px',
                    background: '#1a1a1a', border: '1px solid #222',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px',
                  }}>📦</div>
                )}
                <div>
                  <div style={{ fontWeight: 600, color: '#ddd', fontSize: '15px' }}>{product.name}</div>
                  <div style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace', marginTop: '3px' }}>{id}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>₹{Object.values(sizes)[0]?.price || '—'}</div>
                </div>
              </div>

              {/* Size-stock rows */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(sizes).map(([size, sizeData]) => {
                  const key = `${id}:${size}`;
                  const currentStock = sizeData.stock ?? 0;
                  const editVal = stockEdits[key] !== undefined ? stockEdits[key] : String(currentStock);
                  const isDirty = stockEdits[key] !== undefined && parseInt(stockEdits[key], 10) !== currentStock;
                  const isSaving = savingKey === key;
                  const isLow = currentStock <= 5;

                  return (
                    <div key={size} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* Size badge */}
                      <span style={{
                        fontFamily: 'var(--font-wireframe)', fontSize: '11px', letterSpacing: '2px',
                        background: '#111', border: '1px solid #2a2a2a', borderRadius: '4px',
                        padding: '4px 10px', color: '#888', minWidth: '36px', textAlign: 'center',
                      }}>{size}</span>

                      {/* Current stock indicator */}
                      <span style={{
                        fontSize: '12px',
                        color: isLow ? '#ff8888' : '#c5ecd2',
                        minWidth: '90px',
                      }}>
                        {isLow ? '⚠ ' : '✓ '}Current: {currentStock}
                      </span>

                      {/* Stock input */}
                      <input
                        type="number"
                        min="0"
                        value={editVal}
                        onChange={e => handleStockChange(id, size, e.target.value)}
                        className="admin-input"
                        style={{ width: '90px', textAlign: 'center', padding: '7px 10px' }}
                      />

                      {/* Save button */}
                      <button
                        onClick={() => handleSaveStock(id, size)}
                        disabled={!isDirty || isSaving}
                        style={{
                          padding: '7px 16px',
                          background: isDirty ? 'var(--wire-glow)' : '#111',
                          color: isDirty ? '#000' : '#333',
                          border: isDirty ? 'none' : '1px solid #222',
                          borderRadius: '6px', cursor: isDirty ? 'pointer' : 'default',
                          fontSize: '11px', letterSpacing: '1px',
                          fontFamily: 'var(--font-wireframe)',
                          transition: 'all 0.2s',
                          minWidth: '70px',
                        }}
                      >
                        {isSaving ? '...' : 'SAVE'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Admin page ──────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('orders');

  // ── Orders state ──────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  // ── Categories state ──────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // ── Product upload state ──────────────────────────────────────
  const [productForm, setProductForm] = useState({
    name: '', type: '', description: '', tagline: '', price: '',
    stockS: '', stockM: '', stockL: '', stockXL: '',
  });
  const [productImages, setProductImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // ─────────────────────────────────────────────────────────────
  const fetchOrders = async (q = '') => {
    setLoadingOrders(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await api.get(`/admin/orders/all${params}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await api.get('/categories');
      const topLevel = res.data;
      const allCats = [...topLevel];
      const fetchChildren = async (cats) => {
        for (const cat of cats) {
          if (cat.children?.length > 0) {
            const results = await Promise.all(cat.children.map(id => api.get(`/categories/${id}`).catch(() => null)));
            const children = results.filter(Boolean).map(r => r.data);
            allCats.push(...children);
            await fetchChildren(children);
          }
        }
      };
      await fetchChildren(topLevel);
      setCategories(allCats);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCats(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'categories') fetchCategories();
  }, [activeTab]);

  // ── Orders actions ────────────────────────────────────────────
  const handleMarkCompleted = async (orderId) => {
    setCompletingId(orderId);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { new_status: 'completed' });
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setExpandedOrder(null);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCompletingId(null);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders(searchQuery);
  };

  // ── Product upload ────────────────────────────────────────────
  const handleProductFormChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
  };

  const handleUploadProduct = async () => {
    if (!productForm.name || !productForm.type || !productForm.price) {
      alert('Fill in name, type, and price at minimum.');
      return;
    }
    setUploading(true);
    try {
      const price = parseFloat(productForm.price);
      const sizes = {};
      if (productForm.stockS) sizes.S = { price, stock: parseInt(productForm.stockS) };
      if (productForm.stockM) sizes.M = { price, stock: parseInt(productForm.stockM) };
      if (productForm.stockL) sizes.L = { price, stock: parseInt(productForm.stockL) };
      if (productForm.stockXL) sizes.XL = { price, stock: parseInt(productForm.stockXL) };
      if (Object.keys(sizes).length === 0) sizes.Standard = { price, stock: 100 };

      const createRes = await api.post('/products', {
        type: productForm.type,
        name: productForm.name,
        description: productForm.description,
        tagline: productForm.tagline,
        sizes,
        active: true,
      });
      const productId = createRes.data.product_id;

      if (productImages.length > 0) {
        const formData = new FormData();
        productImages.forEach(f => formData.append('files', f));
        await api.post(`/products/${productId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      alert(`✅ Product "${productForm.name}" created! ID: ${productId}`);
      setProductForm({ name: '', type: '', description: '', tagline: '', price: '', stockS: '', stockM: '', stockL: '', stockXL: '' });
      setProductImages([]);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  const getOrderType = (order) => order.paymentType === 'online' ? 'online' : 'cod';

  const tabs = [
    { key: 'orders', label: '📋 ALL ORDERS' },
    { key: 'products', label: '📦 NEW PRODUCT' },
    { key: 'stock', label: '📊 STOCK MANAGER' },
    { key: 'categories', label: '🗂 CATEGORIES' },
  ];

  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ paddingTop: '100px', minHeight: '100vh', color: '#fff' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '8px' }}>
          <h1 style={{ fontFamily: 'var(--font-wireframe)', color: 'var(--wire-glow)', letterSpacing: '4px', margin: 0 }}>
            TERMINAL // ADMIN
          </h1>
        </div>
        <p style={{ fontSize: '12px', color: '#444', marginBottom: '28px' }}>
          Manage orders, stock, products, and categories from this panel.
        </p>

        {/* Tab bar */}
        <div className="admin-tab-bar" style={{ marginBottom: '24px' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`admin-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ALL ORDERS ─────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-panel">
            <h3 style={{ marginBottom: '20px', color: '#aaa', letterSpacing: '2px', fontSize: '14px' }}>ALL ACTIVE ORDERS</h3>

            <form className="admin-search-row" onSubmit={handleSearch}>
              <input
                className="admin-search-bar"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by order ID, user ID, or product name..."
              />
              <button type="submit" className="admin-search-btn">SEARCH</button>
              {searchQuery && (
                <button type="button" className="admin-search-clear" onClick={() => { setSearchQuery(''); fetchOrders(); }}>✕</button>
              )}
            </form>

            {loadingOrders ? (
              <p style={{ color: '#555', padding: '30px 0', fontFamily: 'var(--font-wireframe)', letterSpacing: '2px' }}>FETCHING ORDERS...</p>
            ) : orders.length === 0 ? (
              <p style={{ color: '#555', padding: '30px 0' }}>No active orders found.</p>
            ) : (
              <div className="admin-orders-list">
                {orders.map(order => {
                  const type = getOrderType(order);
                  const isExpanded = expandedOrder === order.id;
                  const isCompleting = completingId === order.id;

                  return (
                    <div key={order.id} className="admin-order-row">
                      <div className="admin-order-main" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                        <div className="admin-order-left">
                          <span
                            className="order-status-badge"
                            style={{ background: `${STATUS_COLORS[type]}22`, color: STATUS_COLORS[type], borderColor: `${STATUS_COLORS[type]}55` }}
                          >
                            {type.toUpperCase()}
                          </span>
                          <div className="admin-order-id-block">
                            <span className="admin-order-id">{order.id?.substring(0, 18)}...</span>
                            <span className="admin-order-user">uid: {order.userId?.substring(0, 16)}...</span>
                          </div>
                        </div>
                        <div className="admin-order-right">
                          <span style={{ fontSize: '11px', color: '#666', marginRight: '8px' }}>{order.paymentStatus?.toUpperCase()}</span>
                          <span className="admin-order-total">₹{parseFloat(order.grandTotal || 0).toFixed(2)}</span>
                          <span className="admin-order-chevron">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="admin-order-detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="admin-order-detail-inner">
                              <div className="admin-order-detail-row">
                                <span className="detail-label">Full Order ID</span>
                                <span className="detail-value mono">{order.id}</span>
                              </div>
                              <div className="admin-order-detail-row">
                                <span className="detail-label">User ID</span>
                                <span className="detail-value mono">{order.userId}</span>
                              </div>
                              <div className="admin-order-detail-row">
                                <span className="detail-label">Payment Type</span>
                                <span className="detail-value">{order.paymentType?.toUpperCase()}</span>
                              </div>
                              <div className="admin-order-detail-row">
                                <span className="detail-label">Payment Status</span>
                                <span className="detail-value">{order.paymentStatus}</span>
                              </div>
                              {order.shippingAddress && (
                                <div className="admin-order-detail-row">
                                  <span className="detail-label">Ship To</span>
                                  <span className="detail-value">
                                    {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
                                  </span>
                                </div>
                              )}
                              <div style={{ marginTop: '12px' }}>
                                <span className="detail-label">Products</span>
                                <div className="admin-order-products">
                                  {(order.products || []).map((p, i) => (
                                    <div key={i} className="admin-order-product-item">
                                      <span style={{ fontFamily: 'monospace' }}>{p.name || p.productId?.substring(0, 12)}</span>
                                      <span>Size: {p.size}</span>
                                      <span>Qty: {p.quantity}</span>
                                      <span>₹{p.price}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                                <button
                                  className="admin-complete-btn"
                                  onClick={() => handleMarkCompleted(order.id)}
                                  disabled={isCompleting}
                                >
                                  {isCompleting ? 'Marking...' : '✓ Mark as Completed / Delivered'}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── PRODUCT UPLOAD ───────────────────────────────────── */}
        {activeTab === 'products' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-panel">
            <h3 style={{ marginBottom: '20px', color: '#aaa', letterSpacing: '2px', fontSize: '14px' }}>UPLOAD NEW DROP</h3>
            <div className="admin-form-grid">
              <div className="admin-form-row-2">
                <div className="admin-form-field">
                  <label>Product Name *</label>
                  <input value={productForm.name} onChange={e => handleProductFormChange('name', e.target.value)} className="admin-input" placeholder="e.g. Stealth Hoodie" />
                </div>
                <div className="admin-form-field">
                  <label>Type / Category</label>
                  <input value={productForm.type} onChange={e => handleProductFormChange('type', e.target.value)} className="admin-input" placeholder="e.g. Hoodies" />
                </div>
              </div>
              <div className="admin-form-field">
                <label>Description</label>
                <textarea value={productForm.description} onChange={e => handleProductFormChange('description', e.target.value)} className="admin-input" rows={3} placeholder="Describe the fit..." />
              </div>
              <div className="admin-form-field">
                <label>Tagline <span style={{ color: '#b8a8e8', fontSize: '0.55rem', letterSpacing: '1px' }}>— 1–2 punchy lines shown on card</span></label>
                <textarea
                  value={productForm.tagline}
                  onChange={e => handleProductFormChange('tagline', e.target.value)}
                  className="admin-input admin-tagline-input"
                  rows={2}
                  maxLength={120}
                  placeholder="e.g. Built for the streets. Made to outlast."
                />
                <span className="admin-tagline-char-count">{productForm.tagline.length}/120</span>
              </div>
              <div className="admin-form-row-2">
                <div className="admin-form-field">
                  <label>Base Price (₹) *</label>
                  <input type="number" value={productForm.price} onChange={e => handleProductFormChange('price', e.target.value)} className="admin-input" placeholder="999" />
                </div>
              </div>
              <div className="admin-form-row-4">
                {['S', 'M', 'L', 'XL'].map(size => (
                  <div key={size} className="admin-form-field">
                    <label>Stock ({size})</label>
                    <input
                      type="number"
                      value={productForm[`stock${size}`]}
                      onChange={e => handleProductFormChange(`stock${size}`, e.target.value)}
                      className="admin-input"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div className="admin-file-drop" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => setProductImages(Array.from(e.target.files))}
                />
                {productImages.length > 0 ? (
                  <span style={{ color: '#c5ecd2' }}>✓ {productImages.length} image(s) selected</span>
                ) : (
                  <span>+ Click to select images for Cloudinary upload</span>
                )}
              </div>
              <button className="admin-submit-btn" onClick={handleUploadProduct} disabled={uploading}>
                {uploading ? 'UPLOADING...' : 'SUBMIT TO CLOUDINARY & DB'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STOCK MANAGER ────────────────────────────────────── */}
        {activeTab === 'stock' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-panel">
            <StockManager />
          </motion.div>
        )}

        {/* ── CATEGORIES ───────────────────────────────────────── */}
        {activeTab === 'categories' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-panel">
            {loadingCats ? (
              <p style={{ color: '#555', fontFamily: 'var(--font-wireframe)', letterSpacing: '2px' }}>LOADING TREE...</p>
            ) : (
              <AdminCategoryTree categories={categories} onRefresh={fetchCategories} />
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
