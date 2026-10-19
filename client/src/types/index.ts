export type UserRole = 'farmer' | 'buyer' | 'logistics' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface CropProduct {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  pricePerUnit: number;
  currency: string;
  stockKg: number;
  origin: string;
  farmerName: string;
  imageUrl: string;
  rating: number;
  harvestDate: string;
  isOrganic: boolean;
  isDemoData: boolean;
}

export type ProductCategory =
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'pulses'
  | 'spices'
  | 'dairy'
  | 'herbs';

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  quantity: number;
  imageUrl: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'harvesting'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  buyerName: string;
  farmerName: string;
  items: { name: string; quantity: number; unit: string }[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  placedAt: string;
  deliveryDate?: string;
  isDemoData: boolean;
}

export interface PayoutLedgerEntry {
  id: string;
  orderId: string;
  cropName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processed' | 'paid';
  date: string;
  isDemoData: boolean;
}

export interface LogisticsTask {
  id: string;
  type: 'pickup' | 'delivery';
  origin: string;
  destination: string;
  contactName: string;
  contactPhone: string;
  scheduledAt: string;
  status: 'assigned' | 'in_progress' | 'completed';
  cargoKg: number;
  isDemoData: boolean;
}
