import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import api, { auth } from '../api'; // Your firebase/axios setup

const AppContext = createContext();

export function AppProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartWiggle, setCartWiggle] = useState(false);
  const [user, setUser] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [glowColor, setGlowColor] = useState('rgba(255, 255, 255, 0.1)');
  const [syncingCart, setSyncingCart] = useState(false);

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Get real role from backend (source of truth for admin status)
          const profileRes = await api.get('/users/me');
          setIsAdmin(profileRes.data.role === 'admin');

          // Load cart from backend
          const cartRes = await api.get('/cart');
          if (cartRes.data && cartRes.data.length > 0) {
            setCart(cartRes.data.map(item => ({
              cartItemId: item.cart_item_id,
              productId: item.product_id,
              name: item.name,
              size: item.size,
              quantity: item.quantity,
              price: item.price,
              imageUrl: item.imageUrl
            })));
          }
        } catch(e) {
          console.error("Failed to fetch user data or cart", e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setCart([]); // Clear cart on logout
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
      alert("Login failed: " + err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const handleAddToCart = async (product) => {
    let existingIdx = cart.findIndex(item => item.productId === product.productId && item.size === product.size);
    let newCart = [...cart];
    
    if (existingIdx >= 0) {
      const currentQty = newCart[existingIdx].quantity || 1;
      if (product.maxStock !== undefined && currentQty >= product.maxStock) {
        alert("Maximum stock reached. You cannot add more of this item.");
        return;
      }
      const updatedItem = { ...newCart[existingIdx], quantity: currentQty + 1 };
      newCart[existingIdx] = updatedItem;
      setCart(newCart);
      if (user) {
        api.patch(`/cart/${updatedItem.cartItemId}`, null, { params: { quantity: updatedItem.quantity } }).catch(console.error);
      }
    } else {
      const newItem = { ...product, quantity: 1 };
      if (user) {
        try {
          const res = await api.post('/cart', {
            product_id: newItem.productId,
            name: newItem.name,
            size: newItem.size,
            quantity: 1,
            price: newItem.price,
            imageUrl: newItem.imageUrl || newItem.image || ''
          });
          newItem.cartItemId = res.data.cart_item_id;
        } catch (err) {
          console.error("Failed to sync item to cart", err);
        }
      }
      setCart([...newCart, newItem]);
    }
    
    setCartWiggle(true);
    setTimeout(() => setCartWiggle(false), 600);
  };

  const handleRemoveItem = (index) => {
    const itemToRemove = cart[index];
    setCart((prev) => prev.filter((_, idx) => idx !== index));
    if (user && itemToRemove.cartItemId) {
      api.delete(`/cart/${itemToRemove.cartItemId}`).catch(console.error);
    }
  };

  const handleClearCart = () => {
    setCart([]);
    if (user) {
      api.delete('/cart').catch(console.error);
    }
  };

  const handleUpdateQuantity = (index, delta) => {
    let newCart = [...cart];
    let updatedItem = { ...newCart[index] };
    const newQuantity = (updatedItem.quantity || 1) + delta;

    if (newQuantity < 1) {
      handleRemoveItem(index);
      return;
    }
    
    if (delta > 0 && updatedItem.maxStock !== undefined && newQuantity > updatedItem.maxStock) {
      alert("Maximum stock reached for this item.");
      return;
    }

    updatedItem.quantity = newQuantity;
    newCart[index] = updatedItem;
    setCart(newCart);

    if (user && updatedItem.cartItemId) {
      api.patch(`/cart/${updatedItem.cartItemId}`, null, { params: { quantity: newQuantity } })
         .catch(console.error);
    }
  };

  return (
    <AppContext.Provider
      value={{
        cart,
        isCartOpen,
        setIsCartOpen,
        cartWiggle,
        handleAddToCart,
        handleRemoveItem,
        handleClearCart,
        handleUpdateQuantity,
        user,
        isAdmin,
        authLoading,
        loginWithGoogle,
        logout,
        glowColor,
        setGlowColor
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
