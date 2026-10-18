export type UserRole = 'farmer' | 'buyer' | 'business' | 'logistics' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  language: 'en' | 'te' | 'hi';
  isVerified: boolean;
  status: 'active' | 'suspended' | 'pending_verification';
  address?: {
    street?: string;
    villageOrCity?: string;
    district?: string;
    state?: string;
    pinCode?: string;
  };
}

export interface CropListing {
  _id: string;
  farmerId: {
    _id: string;
    name: string;
    phone: string;
    isVerified: boolean;
  };
  farmerProfileId?: {
    farmName: string;
    fpoAffiliation?: string;
    rating: number;
    location: {
      village: string;
      district: string;
      state: string;
      pinCode: string;
    };
  };
  cropName: string;
  variety?: string;
  category: string;
  description: string;
  images: string[];
  qualityGrade: 'A+' | 'A' | 'B+' | 'B';
  pricePerUnitPaise: number;
  unit: 'kg' | 'quintal' | 'box' | 'bunch' | 'crate';
  availableQuantity: number;
  reservedQuantity: number;
  minOrderQuantity: number;
  harvestDate: string;
  expectedShelfLifeDays: number;
  location: {
    village: string;
    district: string;
    state: string;
    pinCode: string;
  };
  isOrganicCertified: boolean;
  status: 'active' | 'sold_out' | 'paused' | 'archived';
  viewsCount: number;
  createdAt: string;
}

export interface CartItem {
  listing: CropListing;
  quantity: number;
}

export interface OrderItem {
  listingId: string;
  cropName: string;
  variety?: string;
  unit: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  farmerId: string;
  farmerName: string;
  farmLocation: string;
  qualityGrade: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  buyerRole: string;
  buyerPhone: string;
  items: OrderItem[];
  pricing: {
    grossProductValuePaise: number;
    farmerPayoutPaise: number;
    platformCommissionPaise: number;
    operationsReservePaise: number;
    deliveryFeePaise: number;
    finalPayablePaise: number;
  };
  deliveryAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
  };
  deliverySlot: {
    date: string;
    timeWindow: string;
  };
  status:
    | 'pending_payment'
    | 'confirmed'
    | 'accepted'
    | 'preparing'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
  statusHistory: Array<{
    status: string;
    note?: string;
    timestamp: string;
    role?: string;
  }>;
  payment: {
    status: string;
    gateway: string;
    transactionId?: string;
    paidAt?: string;
  };
  logistics?: {
    assignedPartnerId?: string;
    partnerName?: string;
    partnerPhone?: string;
    pickupTime?: string;
    deliveredTime?: string;
    proofOfDelivery?: {
      otpVerified?: boolean;
      recipientSignature?: string;
      notes?: string;
    };
  };
  createdAt: string;
}

export interface PayoutRecord {
  _id: string;
  orderId: string;
  orderNumber: string;
  farmerId: string;
  farmerName: string;
  grossProductValuePaise: number;
  farmerSharePct: number;
  farmerPayoutPaise: number;
  platformCommissionPaise: number;
  operationsReservePaise: number;
  settlementStatus: 'accrued' | 'processing' | 'settled' | 'on_hold' | 'cancelled';
  bankAccountLast4?: string;
  upiId?: string;
  transactionReference?: string;
  settledAt?: string;
  notes?: string;
  createdAt: string;
}

export interface QuoteRequest {
  _id: string;
  buyerId: string;
  buyerName: string;
  buyerBusiness: string;
  cropName: string;
  category: string;
  requiredQuantity: number;
  unit: string;
  targetPricePerUnitPaise?: number;
  frequency: string;
  requiredByDate: string;
  deliveryLocation: {
    address: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
  };
  notes?: string;
  status: 'open' | 'quotes_received' | 'accepted' | 'fulfilled' | 'closed';
  responses: Array<{
    farmerId: string;
    farmerName: string;
    farmLocation: string;
    offeredPricePerUnitPaise: number;
    availableQuantity: number;
    deliveryLeadDays: number;
    notes?: string;
    createdAt: string;
  }>;
  createdAt: string;
}
