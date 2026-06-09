import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAppContext } from '../context/AppContext';
import ProductReviews from '../components/ProductReviews';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const { handleAddToCart } = useAppContext();

  const [category, setCategory] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState({});
  const [selectedSizes, setSelectedSizes] = useState({});
  const [expandedProduct, setExpandedProduct] = useState(null);

  const handleSizeSelect = (productId, size) => {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }));
  };

  useEffect(() => {
    setLoading(true);
    setCategory(null);
    setSubCategories([]);
    setProducts([]);

    const fetchData = async () => {
      try {
        const res = await api.get(`/categories/${categoryId}`);
        const cat = res.data;
        setCategory(cat);

        // Build breadcrumb by walking parentId chain
        const crumbs = [{ id: categoryId, name: cat.name, slug: cat.slug || categoryId }];
        let parentId = cat.parentId;
        while (parentId) {
          try {
            const parentRes = await api.get(`/categories/${parentId}`);
            crumbs.unshift({ id: parentId, name: parentRes.data.name, slug: parentRes.data.slug || parentId });
            parentId = parentRes.data.parentId;
          } catch { break; }
        }
        setBreadcrumb(crumbs);

        // Fetch sub-categories
        if (cat.children && cat.children.length > 0) {
          const childPromises = cat.children.map((id) => api.get(`/categories/${id}`));
          const childRes = await Promise.allSettled(childPromises);
          setSubCategories(
            childRes
              .filter((r) => r.status === 'fulfilled')
              .map((r) => r.value.data)
          );
        }

        // Fetch products
        if (cat.products && cat.products.length > 0) {
          const prodPromises = cat.products.map((id) => api.get(`/products/${id}`));
          const prodRes = await Promise.allSettled(prodPromises);
          setProducts(
            prodRes
              .filter((r) => r.status === 'fulfilled')
              .map((r) => r.value.data)
          );
        }
      } catch (err) {
        console.error('Failed to load category:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categoryId]);

  const cycleImage = (productId, imagesLen) => {
    setImgIdx((prev) => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % imagesLen,
    }));
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ paddingTop: '120px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ color: 'var(--wire-glow)', fontFamily: 'var(--font-wireframe)', letterSpacing: '4px' }}
        >
          LOADING...
        </motion.div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="page-wrapper" style={{ paddingTop: '120px', minHeight: '100vh', textAlign: 'center', color: '#666', padding: '120px 2rem' }}>
        <p>Category not found.</p>
        <Link to="/" style={{ color: 'var(--wire-glow)', textDecoration: 'none', fontFamily: 'var(--font-wireframe)' }}>← Back Home</Link>
      </div>
    );
  }

  const defaultHex = '#dcd0ff';

  return (
    <motion.div
      className="page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ paddingTop: '100px', minHeight: '100vh', color: '#fff' }}
    >
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 3.5rem' }}>

        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link" style={{ cursor: 'pointer' }}>Home</Link>
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span className="breadcrumb-sep">›</span>
              {idx === breadcrumb.length - 1 ? (
                <span className="breadcrumb-current">{crumb.name}</span>
              ) : (
                <Link to={`/category/${crumb.slug || crumb.id}`} className="breadcrumb-link" style={{ cursor: 'pointer', textDecoration: 'underline' }}>{crumb.name}</Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Category Header */}
        <div className="section-header" style={{ padding: 0, marginBottom: '3rem' }}>
          <div className="header-meta">
            <span className="marker-circle"></span>
            <span>CATEGORY // {category.name.toUpperCase()}</span>
          </div>
          <h1 className="header-graffiti" style={{ fontFamily: 'var(--font-wireframe)' }}>
            {category.name.toUpperCase()}
          </h1>
        </div>

        {/* Sub-categories grid */}
        {subCategories.length > 0 && (
          <section style={{ marginBottom: '4rem' }}>
            <div className="category-hero-grid">
              {subCategories.map((sub, idx) => (
                <motion.div
                  key={sub.categoryId}
                  className="category-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Link to={`/category/${sub.slug || sub.categoryId}`} className="category-card-link">
                    {sub.thumbnail && (
                      <img src={sub.thumbnail} alt={sub.name} className="category-card-img" />
                    )}
                    <div className="category-card-overlay">
                      <span className="category-card-name">{sub.name}</span>
                      {sub.children?.length > 0 && (
                        <span className="category-card-meta">{sub.children.length} sub-categories</span>
                      )}
                      {sub.products?.length > 0 && (
                        <span className="category-card-meta">{sub.products.length} items</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Products grid */}
        {products.length > 0 && (
          <section>
            {subCategories.length > 0 && (
              <div className="header-meta" style={{ marginBottom: '1.5rem' }}>
                <span className="marker-circle"></span>
                <span>PRODUCTS IN THIS CATEGORY</span>
              </div>
            )}
            <div className="products-grid">
              {products.map((prod) => {
                const images = prod.images && prod.images.length > 0 ? prod.images : [`https://placehold.co/400x500/111111/dcd0ff?text=${prod.name?.replace(/ /g, '+')}`];
                const currentImg = images[imgIdx[prod.product_id] || 0];
                const firstSize = prod.sizes && Object.keys(prod.sizes).length > 0 ? Object.entries(prod.sizes)[0] : null;

                return (
                  <motion.div
                    key={prod.product_id}
                    className="product-card"
                    style={{ '--accent-color': defaultHex }}
                    layout
                  >
                    <div className="product-card-wire"></div>
                    <div className="product-image-container" onClick={() => setExpandedProduct(prod)} style={{ cursor: 'pointer', position: 'relative' }}>
                      <div className="product-glow-bg" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '8px' }}>
                        <img src={currentImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(35px)', opacity: 0.65, transform: 'scale(1.15)' }} />
                      </div>
                      <div className="product-wireframe-placeholder" style={{ position: 'relative' }}>
                        <AnimatePresence mode="wait">
                          <motion.img
                            key={currentImg}
                            src={currentImg}
                            alt={prod.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85, borderRadius: '8px' }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.85 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                          />
                        </AnimatePresence>
                        {images.length > 1 && (
                          <div className="img-dots">
                            {images.map((_, i) => (
                              <span key={i} className={`img-dot ${i === (imgIdx[prod.product_id] || 0) ? 'active' : ''}`}></span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="product-info">
                      <div className="product-info-top">
                        <h4 className="product-name">{prod.name}</h4>
                        <span className="product-price">
                          ₹{firstSize ? firstSize[1].price : '—'}
                        </span>
                      </div>
                      <ProductReviews productId={prod.product_id} count={prod.reviews?.count} />
                      <div className="product-sizes-row">
                        {prod.sizes && Object.entries(prod.sizes).map(([size, details]) => {
                          const isOutOfStock = details.stock === 0;
                          const isSelected = selectedSizes[prod.product_id] === size;
                          return (
                            <button
                              key={size}
                              className={`size-btn ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                              onClick={() => !isOutOfStock && handleSizeSelect(prod.product_id, size)}
                              disabled={isOutOfStock}
                              title={isOutOfStock ? 'Out of Stock' : `₹${details.price}`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                      <div className="product-info-bottom">
                        <span className="product-color" style={{ color: '#aaa', fontSize: '12px' }}>
                          {prod.description?.substring(0, 30)}...
                        </span>
                        <button
                          onClick={() => {
                            const size = selectedSizes[prod.product_id];
                            if (!size) {
                              alert('Please select a size first.');
                              return;
                            }
                            handleAddToCart({
                              ...prod,
                              price: prod.sizes[size].price,
                              maxStock: prod.sizes[size].stock,
                              size: size,
                              color: defaultHex,
                              productId: prod.product_id,
                            });
                          }}
                          className={`flex-it-btn ${!selectedSizes[prod.product_id] ? 'disabled' : ''}`}
                        >
                          <span>{selectedSizes[prod.product_id] ? 'Flex It' : 'Select Size'}</span>
                          <span className="btn-arrow-glyph">→</span>
                        </button>
                      </div>
                      {prod.tagline && (
                        <div className="product-tagline-strip">
                          <span className="product-tagline-quote">"</span>
                          <span className="product-tagline-text">{prod.tagline}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {subCategories.length === 0 && products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
            <p style={{ fontFamily: 'var(--font-wireframe)', letterSpacing: '3px' }}>NO ITEMS YET</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Check back later for drops in this category.</p>
          </div>
        )}
      </main>

      {/* Expanded Product Modal */}
      <AnimatePresence>
        {expandedProduct && (
          <div className="product-modal-backdrop" onClick={() => setExpandedProduct(null)}>
            {/* Modal Aura Glow */}
            <div className="modal-aura-glow" style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: -1 }}>
              <img 
                src={(expandedProduct.images && expandedProduct.images.length > 0 ? expandedProduct.images : [`https://placehold.co/400x500/111111/dcd0ff?text=${expandedProduct.name?.replace(/ /g, '+')}`])[imgIdx[expandedProduct.product_id] || 0]} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(80px)', opacity: 0.4, transform: 'scale(1.2)' }} 
              />
            </div>
            
            <motion.div 
              className="product-modal-content"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close-btn" onClick={() => setExpandedProduct(null)}>×</button>
              
              <div className="modal-grid">
                <div className="modal-image-col" onClick={() => cycleImage(expandedProduct.product_id, expandedProduct.images?.length || 1)} style={{ cursor: expandedProduct.images?.length > 1 ? 'pointer' : 'default' }}>
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={imgIdx[expandedProduct.product_id] || 0}
                      src={(expandedProduct.images && expandedProduct.images.length > 0 ? expandedProduct.images : [`https://placehold.co/400x500/111111/dcd0ff?text=${expandedProduct.name?.replace(/ /g, '+')}`])[imgIdx[expandedProduct.product_id] || 0]}
                      alt={expandedProduct.name}
                      className="modal-main-image"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  </AnimatePresence>
                  {(expandedProduct.images?.length > 1) && (
                    <div className="img-dots">
                      {expandedProduct.images.map((_, i) => (
                        <span key={i} className={`img-dot ${i === (imgIdx[expandedProduct.product_id] || 0) ? 'active' : ''}`}></span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="modal-info-col">
                  <h2 className="modal-product-name">{expandedProduct.name}</h2>
                  <div className="modal-product-price">
                    ₹{expandedProduct.sizes && Object.keys(expandedProduct.sizes).length > 0 ? Object.values(expandedProduct.sizes)[0].price : '—'}
                  </div>
                  
                  {expandedProduct.tagline && (
                    <div className="modal-tagline">
                      "{expandedProduct.tagline}"
                    </div>
                  )}
                  
                  <p className="modal-description">{expandedProduct.description}</p>
                  
                  <div className="modal-sizes-section">
                    <div className="modal-section-label">SELECT SIZE</div>
                    <div className="product-sizes-row" style={{ marginTop: '0', marginBottom: '20px' }}>
                      {expandedProduct.sizes && Object.entries(expandedProduct.sizes).map(([size, details]) => {
                        const isOutOfStock = details.stock === 0;
                        const isSelected = selectedSizes[expandedProduct.product_id] === size;
                        return (
                          <button
                            key={size}
                            className={`size-btn ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}
                            onClick={() => !isOutOfStock && handleSizeSelect(expandedProduct.product_id, size)}
                            disabled={isOutOfStock}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      const size = selectedSizes[expandedProduct.product_id];
                      if (!size) {
                        alert('Please select a size first.');
                        return;
                      }
                      handleAddToCart({
                        ...expandedProduct,
                        price: expandedProduct.sizes[size].price,
                        maxStock: expandedProduct.sizes[size].stock,
                        size: size,
                        color: defaultHex,
                        productId: expandedProduct.product_id,
                      });
                      setExpandedProduct(null); // Optional: close modal on add to cart
                    }}
                    className={`modal-flex-it-btn ${!selectedSizes[expandedProduct.product_id] ? 'disabled' : ''}`}
                  >
                    {selectedSizes[expandedProduct.product_id] ? 'FLEX IT (ADD TO BAG)' : 'SELECT A SIZE'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
