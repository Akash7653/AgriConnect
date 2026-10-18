export const USER_ROLES = {
  FARMER: 'farmer',
  BUYER: 'buyer', // Household consumer
  BUSINESS: 'business', // B2B: Restaurant, Hotel, Supermarket, Institution
  LOGISTICS: 'logistics', // Delivery partner
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ORDER_STATUSES = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export const CROP_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains & Cereals',
  'Pulses',
  'Spices',
  'Greens & Herbs',
  'Organic Special',
] as const;

export const QUALITY_GRADES = ['A+', 'A', 'B+', 'B'] as const;

export const DEFAULT_PRICING_CONFIG = {
  farmerSharePct: 90,
  platformCommissionPct: 8,
  opsReservePct: 2,
  defaultDeliveryFeePaise: 4000, // ₹40.00
  freeDeliveryThresholdPaise: 50000, // ₹500.00
};
