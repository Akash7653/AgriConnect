import { API_BASE_URL } from '@/config/app';
import { ApiError, request } from './api';
import type { CropProduct, ProductCategory } from '@/types';
import type { AuthSession } from '@/types';

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
    description?: string;
    minOrderQuantity?: number;
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
  'organic-special': 'Organic Special',
};

function mapListing(listing: ProductListResponse['listings'][number]): CropProduct {
  const category = (Object.keys(categoryNames) as ProductCategory[])
    .find((key) => categoryNames[key] === listing.category);
  return {
    id: listing._id,
    name: listing.cropName,
    category: category ?? 'vegetables',
    unit: listing.unit,
    pricePerUnit: listing.pricePerUnitPaise / 100,
    currency: 'INR',
    stockKg: listing.availableQuantity,
    origin: [listing.location?.district, listing.location?.state].filter(Boolean).join(', '),
    farmerName: listing.farmerId?.name ?? 'Verified farmer',
    imageUrl: listing.images?.[0] ?? '',
    harvestDate: listing.harvestDate ?? new Date().toISOString(),
    isOrganic: Boolean(listing.isOrganicCertified),
    description: listing.description ?? '',
    minOrderQuantity: listing.minOrderQuantity ?? 1,
  };
}

export const ProductsService = {
  async list(session: AuthSession | null, filters?: { category?: ProductCategory; query?: string; state?: string; district?: string; limit?: number }): Promise<CropProduct[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', categoryNames[filters.category]);
    if (filters?.query) params.set('search', filters.query);
    if (filters?.state) params.set('state', filters.state);
    if (filters?.district) params.set('district', filters.district);
    if (filters?.limit) params.set('limit', String(Math.min(100, filters.limit)));
    const qs = params.toString();
    const endpoint = session ? '/crops' : '/storefront/products';
    const data = await request<ProductListResponse>(`${endpoint}${qs ? `?${qs}` : ''}`, session ? { token: session.token } : undefined);
    return data.listings.map(mapListing);
  },
};

export function uploadProductImage(
  session: AuthSession,
  listingId: string,
  file: File,
  onProgress: (percentage: number) => void,
): Promise<{ image: { url: string; publicId: string } }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('image', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/crops/${encodeURIComponent(listingId)}/images`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new ApiError('Network error while uploading the product image.'));
    xhr.onload = () => {
      let response: { image?: { url: string; publicId: string }; message?: string };
      try {
        response = JSON.parse(xhr.responseText) as typeof response;
      } catch {
        reject(new ApiError('The image server returned an invalid response.', xhr.status));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || !response.image) {
        reject(new ApiError(response.message || `Image upload failed (${xhr.status}).`, xhr.status));
        return;
      }
      onProgress(100);
      resolve({ image: response.image });
    };
    xhr.send(form);
  });
}

export async function removeProductImage(session: AuthSession, listingId: string, publicId: string): Promise<void> {
  await request(`/crops/${encodeURIComponent(listingId)}/images`, {
    method: 'DELETE',
    token: session.token,
    body: JSON.stringify({ publicId }),
  });
}
