import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

/**
 * Wraps a route and redirects if the user doesn't meet the required auth level.
 *
 * Props:
 *   requireAuth  – redirect to '/' if no user logged in (default: true)
 *   requireAdmin – redirect to '/dashboard' if logged in but not admin
 */
export default function ProtectedRoute({ children, requireAuth = true, requireAdmin = false }) {
  const { user, isAdmin, authLoading } = useAppContext();

  // Wait until auth state is resolved before making any redirect decision
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--wire-glow)', fontFamily: 'var(--font-wireframe)', letterSpacing: '4px',
      }}>
        VERIFYING ACCESS...
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    // Authenticated but not admin — kick to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
