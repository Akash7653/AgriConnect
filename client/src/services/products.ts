import { request } from './api';
import type { CropProduct, ProductCategory } from '@/types';

interface ProductListResponse {
  listings: Array<{
    _id: string;
    cropName: string;
    category: string;
    unit: string;
    pricePerUnitPaise: number;
    availableQuantity: number;
    images?: string[];
    location?: { village?: string; district?: string; state?: string };
    farmerId?: { name?: string };
    isOrganicCertified?: boolean;
    qualityGrade?: string;
    harvestDate?: string;
  }>;
}

const categoryNames: Record<ProductCategory, string> = {
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains & Cereals',
  pulses: 'Pulses',
  spices: 'Spices',
  'dairy': 'Dairy',
  herbs: 'Greens & Herbs',
};

function mapListing(listing: ProductListResponse['listings'][number]): CropProduct {
  const category = Object.entries(categoryNames).find(([, label]) => label === listing.category)?.[0];
  return {
    id: listing._id,
    name: listing.cropName,
    category: (category as ProductCategory | undefined) ?? 'vegetables',
    unit: listing.unit,
    pricePerUnit: listing.pricePerUnitPaise / 100,
    currency: 'INR',
    stockKg: listing.availableQuantity,
    origin: [listing.location?.district, listing.location?.state].filter(Boolean).join(', '),
    farmerName: listing.farmerId?.name ?? 'Verified farmer',
    imageUrl: listing.images?.[0] ?? 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=800&q=80',
    rating: 5,
    harvestDate: listing.harvestDate ?? new Date().toISOString(),
    isOrganic: Boolean(listing.isOrganicCertified),
    isDemoData: false,
  };
}

export const ProductsService = {
  async list(filters?: { category?: ProductCategory; query?: string }): Promise<CropProduct[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', categoryNames[filters.category]);
    if (filters?.query) params.set('search', filters.query);
    const qs = params.toString();
    const data = await request<ProductListResponse>(`/crops${qs ? `?${qs}` : ''}`);
    return data.listings.map(mapListing);
  },
};
