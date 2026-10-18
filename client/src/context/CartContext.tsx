import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, CropListing } from '../types/index.js';
import { getSocket } from '../services/socket.js';

interface CartContextType {
  items: CartItem[];
  addToCart: (listing: CropListing, quantity?: number) => void;
  updateQuantity: (listingId: string, quantity: number) => void;
  removeFromCart: (listingId: string) => void;
  clearCart: () => void;
  totalItems: number;
  grossValuePaise: number;
  farmerPayoutPaise: number;
  platformFeePaise: number;
  deliveryFeePaise: number;
  finalPayablePaise: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('agriconnect_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('agriconnect_cart', JSON.stringify(items));
  }, [items]);

  // Listen to live inventory updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleInventoryUpdate = (data: { listingId: string; availableQuantity: number }) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.listing._id === data.listingId) {
            const newAvailable = data.availableQuantity;
            const updatedListing = { ...item.listing, availableQuantity: newAvailable };
            const newQty = Math.min(item.quantity, Math.max(1, newAvailable));
            return { ...item, listing: updatedListing, quantity: newQty };
          }
          return item;
        })
      );
    };

    socket.on('inventory:updated', handleInventoryUpdate);
    return () => {
      socket.off('inventory:updated', handleInventoryUpdate);
    };
  }, []);

  const addToCart = (listing: CropListing, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.listing._id === listing._id);
      if (existing) {
        const nextQty = Math.min(listing.availableQuantity, existing.quantity + quantity);
        return prev.map((i) => (i.listing._id === listing._id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { listing, quantity: Math.min(listing.availableQuantity, quantity) }];
    });
  };

  const updateQuantity = (listingId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(listingId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.listing._id === listingId
          ? { ...i, quantity: Math.min(i.listing.availableQuantity, quantity) }
          : i
      )
    );
  };

  const removeFromCart = (listingId: string) => {
    setItems((prev) => prev.filter((i) => i.listing._id !== listingId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const grossValuePaise = items.reduce(
    (acc, curr) => acc + curr.listing.pricePerUnitPaise * curr.quantity,
    0
  );

  // 90% Farmer / 8% Platform / 2% Reserve
  const farmerPayoutPaise = Math.round(grossValuePaise * 0.9);
  const platformFeePaise = Math.round(grossValuePaise * 0.08);

  // Free delivery above ₹500 (50000 paise), otherwise ₹40 (4000 paise)
  const deliveryFeePaise = grossValuePaise >= 50000 || grossValuePaise === 0 ? 0 : 4000;
  const finalPayablePaise = grossValuePaise + deliveryFeePaise;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalItems,
        grossValuePaise,
        farmerPayoutPaise,
        platformFeePaise,
        deliveryFeePaise,
        finalPayablePaise,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
