import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';

/**
 * AdminCategoryTree — recursive tree editor for the category system.
 * Edits are local until Save is clicked per-node (partial Firestore update only).
 *
 * Props:
 *   categories: CategoryOut[]  — all categories (flat list, tree built from parentId)
 *   onRefresh: () => void      — called after any create/update/delete
 */

function TreeNode({ node, allCategories, onRefresh, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(node.name);
  const [editThumb, setEditThumb] = useState(node.thumbnail || '');
  const [editProducts, setEditProducts] = useState((node.products || []).join(', '));

  // Add child form state
  const [newName, setNewName] = useState('');
  const [newThumb, setNewThumb] = useState('');

  const children = allCategories.filter((c) => c.parentId === node.categoryId);

  const handleSave = async () => {
    setSaving(true);
    try {
      const productsArray = editProducts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.put(`/categories/${node.categoryId}`, {
        name: editName,
        thumbnail: editThumb,
        parentId: node.parentId ?? null,
        children: node.children || [],
        products: productsArray,
      });
      setEditing(false);
      onRefresh();
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${node.name}"? This won't delete child categories.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${node.categoryId}`);
      onRefresh();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleAddChild = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/categories', {
        name: newName.trim(),
        thumbnail: newThumb.trim(),
        parentId: node.categoryId,
        children: [],
        products: [],
      });
      setAddingChild(false);
      setNewName('');
      setNewThumb('');
      onRefresh();
    } catch (err) {
      alert('Create failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const indent = depth * 24;

  return (
    <div className="tree-node-wrapper" style={{ marginLeft: `${indent}px` }}>
      {/* Connector line */}
      {depth > 0 && <div className="tree-connector" />}

      <div className="tree-node">
        {/* Node row */}
        <div className="tree-node-row">
          {/* Expand toggle */}
          <button
            className="tree-expand-btn"
            onClick={() => setExpanded(!expanded)}
            disabled={children.length === 0}
            style={{ opacity: children.length === 0 ? 0.2 : 1 }}
          >
            {expanded ? '▾' : '▸'}
          </button>

          {/* Thumbnail preview */}
          {node.thumbnail ? (
            <img src={node.thumbnail} alt="" className="tree-thumb" />
          ) : (
            <div className="tree-thumb-placeholder">📁</div>
          )}

          {/* Name */}
          <span className="tree-node-name">{node.name}</span>

          {/* Meta */}
          <span className="tree-node-meta">
            {children.length > 0 && `${children.length} sub`}
            {node.products?.length > 0 && ` • ${node.products.length} products`}
          </span>

          {/* Actions */}
          <div className="tree-node-actions">
            <button className="tree-action-btn" title="Add child" onClick={() => { setAddingChild(true); setExpanded(true); }}>＋</button>
            <button className="tree-action-btn" title="Edit" onClick={() => setEditing(!editing)}>✏️</button>
            <button className="tree-action-btn danger" title="Delete" onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : '🗑'}
            </button>
          </div>
        </div>

        {/* Inline edit form */}
        <AnimatePresence>
          {editing && (
            <motion.div
              className="tree-inline-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="tree-form-row">
                <label>Name</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="tree-input" />
              </div>
              <div className="tree-form-row">
                <label>Thumbnail URL</label>
                <input value={editThumb} onChange={(e) => setEditThumb(e.target.value)} className="tree-input" placeholder="https://res.cloudinary.com/..." />
                {editThumb && <img src={editThumb} alt="preview" className="tree-thumb-preview" />}
              </div>
              <div className="tree-form-row">
                <label>Product IDs (comma-separated)</label>
                <input value={editProducts} onChange={(e) => setEditProducts(e.target.value)} className="tree-input" placeholder="uuid1, uuid2, ..." />
              </div>
              <div className="tree-form-actions">
                <button className="tree-btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
                <button className="tree-btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add child form */}
        <AnimatePresence>
          {addingChild && (
            <motion.div
              className="tree-inline-form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="tree-form-title">Add sub-category under "{node.name}"</p>
              <div className="tree-form-row">
                <label>Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="tree-input" placeholder="e.g. Hoodies" />
              </div>
              <div className="tree-form-row">
                <label>Thumbnail URL</label>
                <input value={newThumb} onChange={(e) => setNewThumb(e.target.value)} className="tree-input" placeholder="https://res.cloudinary.com/..." />
              </div>
              <div className="tree-form-actions">
                <button className="tree-btn-cancel" onClick={() => setAddingChild(false)}>Cancel</button>
                <button className="tree-btn-save" onClick={handleAddChild} disabled={!newName.trim()}>
                  Create
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Children */}
      <AnimatePresence>
        {expanded && children.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children.map((child) => (
              <TreeNode
                key={child.categoryId}
                node={child}
                allCategories={allCategories}
                onRefresh={onRefresh}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminCategoryTree({ categories, onRefresh }) {
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootName, setRootName] = useState('');
  const [rootThumb, setRootThumb] = useState('');

  const topLevel = categories.filter((c) => !c.parentId);

  const handleAddRoot = async () => {
    if (!rootName.trim()) return;
    try {
      await api.post('/categories', {
        name: rootName.trim(),
        thumbnail: rootThumb.trim(),
        parentId: null,
        children: [],
        products: [],
      });
      setAddingRoot(false);
      setRootName('');
      setRootThumb('');
      onRefresh();
    } catch (err) {
      alert('Create failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="admin-category-tree">
      <div className="tree-header">
        <span className="tree-header-label">CATEGORY TREE</span>
        <button className="tree-add-root-btn" onClick={() => setAddingRoot(true)}>
          ＋ Add Top-Level Category
        </button>
      </div>

      {/* Add root form */}
      <AnimatePresence>
        {addingRoot && (
          <motion.div
            className="tree-inline-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="tree-form-title">New Top-Level Category</p>
            <div className="tree-form-row">
              <label>Name *</label>
              <input value={rootName} onChange={(e) => setRootName(e.target.value)} className="tree-input" placeholder="e.g. Tops" />
            </div>
            <div className="tree-form-row">
              <label>Thumbnail URL</label>
              <input value={rootThumb} onChange={(e) => setRootThumb(e.target.value)} className="tree-input" placeholder="https://res.cloudinary.com/..." />
            </div>
            <div className="tree-form-actions">
              <button className="tree-btn-cancel" onClick={() => setAddingRoot(false)}>Cancel</button>
              <button className="tree-btn-save" onClick={handleAddRoot} disabled={!rootName.trim()}>Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tree */}
      {topLevel.length === 0 ? (
        <p style={{ color: '#555', padding: '30px 0', fontFamily: 'var(--font-wireframe)', letterSpacing: '2px' }}>
          NO CATEGORIES YET — add one above
        </p>
      ) : (
        topLevel.map((cat) => (
          <TreeNode
            key={cat.categoryId}
            node={cat}
            allCategories={categories}
            onRefresh={onRefresh}
            depth={0}
          />
        ))
      )}
    </div>
  );
}
