export type UserRole = 'farmer' | 'buyer' | 'business' | 'logistics' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  requestedRole?: Exclude<UserRole, 'admin'>;
  requestedFarm?: {
    farmName: string;
    village: string;
    district: string;
    state: string;
    pinCode: string;
  };
  address?: {
    street?: string;
    villageOrCity?: string;
    district?: string;
    state?: string;
    pinCode?: string;
  };
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
  harvestDate: string;
  isOrganic: boolean;
  description: string;
  minOrderQuantity: number;
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

export interface Order {
  _id: string;
  orderNumber: string;
  buyerName: string;
  items: { cropName: string; quantity: number; unit: string; farmerName: string }[];
  pricing: { finalPayablePaise: number };
  status: OrderStatus;
  createdAt: string;
}

export type OrderStatus = 'pending_payment' | 'confirmed' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';
