import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, CropProduct } from '@/types';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const canShop = user?.role === 'buyer' || user?.role === 'business';
  const [cart, setCart] = useState<{ ownerId: string; items: CartItem[] }>(() => ({
    ownerId: userId,
    items: readCart(userId),
  }));
  const items = useMemo(
    () => cart.ownerId === userId ? cart.items : [],
    [cart.items, cart.ownerId, userId],
  );

  useEffect(() => {
    if (cart.ownerId !== userId) {
      const isBuyerLogin = cart.ownerId === 'guest' && userId !== 'guest' && canShop;
      const nextItems = isBuyerLogin
        ? mergeCartItems(readCart(userId), cart.items)
        : readCart(userId);
      setCart({ ownerId: userId, items: nextItems });
      if (isBuyerLogin) {
        try {
          localStorage.removeItem('agriconnect_cart:guest');
        } catch (error) {
          console.error('Guest cart could not be cleared after sign-in.', error);
        }
      }
      return;
    }
    try {
      localStorage.setItem(`agriconnect_cart:${cart.ownerId}`, JSON.stringify(cart.items));
    } catch (error) {
      console.error('Shopping cart could not be saved on this device.', error);
    }
  }, [cart, userId, canShop]);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue['add'] = (product, quantity) => {
      setCart((current) => {
        if (current.ownerId !== userId) return current;
        const prev = current.items;
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          const nextItems = prev.map((i) => i.productId === product.id
            ? { ...i, quantity: Math.min(product.stockKg, i.quantity + quantity), availableQuantity: product.stockKg }
            : i);
          return { ...current, items: nextItems };
        }
        return {
          ...current,
          items: [
            ...prev,
            {
              productId: product.id,
              name: product.name,
              unit: product.unit,
              pricePerUnit: product.pricePerUnit,
              quantity,
              imageUrl: product.imageUrl,
              availableQuantity: product.stockKg,
              minOrderQuantity: product.minOrderQuantity,
            },
          ],
        };
      });
    };

    const remove: CartContextValue['remove'] = (productId) => {
      setCart((current) => ({ ...current, items: current.items.filter((i) => i.productId !== productId) }));
    };

    const setQuantity: CartContextValue['setQuantity'] = (productId, quantity) => {
      setCart((current) => ({
        ...current,
        items: current.items
          .map((item) => item.productId !== productId ? item : {
            ...item,
            quantity: Math.min(item.availableQuantity, Math.max(item.minOrderQuantity, quantity)),
          })
          .filter((item) => item.productId !== productId || quantity > 0),
      }));
    };

    const clear = () => setCart((current) => ({ ...current, items: [] }));

    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = items.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);

    return { items, add, remove, setQuantity, clear, totalItems, totalAmount };
  }, [items, userId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function readCart(userId: string): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`agriconnect_cart:${userId}`) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CartItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.productId === 'string' &&
      typeof item.quantity === 'number' &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.pricePerUnit === 'number'
    ).map((item) => ({
      ...item,
      availableQuantity: typeof item.availableQuantity === 'number' ? item.availableQuantity : Number.MAX_SAFE_INTEGER,
      minOrderQuantity: typeof item.minOrderQuantity === 'number' ? item.minOrderQuantity : 1,
    }));
  } catch {
    return [];
  }
}

function mergeCartItems(accountItems: CartItem[], guestItems: CartItem[]): CartItem[] {
  const merged = new Map(accountItems.map((item) => [item.productId, item]));
  for (const guestItem of guestItems) {
    const accountItem = merged.get(guestItem.productId);
    const availableQuantity = accountItem
      ? Math.min(accountItem.availableQuantity, guestItem.availableQuantity)
      : guestItem.availableQuantity;
    merged.set(guestItem.productId, {
      ...(accountItem ?? guestItem),
      availableQuantity,
      quantity: Math.min(availableQuantity, (accountItem?.quantity ?? 0) + guestItem.quantity),
    });
  }
  return [...merged.values()];
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
