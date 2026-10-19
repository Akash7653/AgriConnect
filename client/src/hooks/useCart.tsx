import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, CropProduct } from '@/types';

interface CartContextValue {
  items: CartItem[];
  add: (product: CropProduct, quantity: number) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue['add'] = (product, quantity) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            pricePerUnit: product.pricePerUnit,
            quantity,
            imageUrl: product.imageUrl,
          },
        ];
      });
    };

    const remove: CartContextValue['remove'] = (productId) => {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    };

    const setQuantity: CartContextValue['setQuantity'] = (productId, quantity) => {
      setItems((prev) =>
        prev
          .map((i) => (i.productId === productId ? { ...i, quantity } : i))
          .filter((i) => i.quantity > 0)
      );
    };

    const clear = () => setItems([]);

    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);

    return { items, add, remove, setQuantity, clear, totalItems, totalAmount };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
