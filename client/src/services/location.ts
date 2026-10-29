import { request } from '@/services/api';

export interface LocationServiceability {
  configured: boolean;
  serviceable: boolean | null;
  message?: string;
  zone?: {
    estimatedDeliveryDays?: number;
    estimatedDeliveryDaysMin?: number;
    estimatedDeliveryDaysMax?: number;
  };
}

export interface DeliveryLocation {
  city: string;
  state: string;
  pinCode: string;
}

const CACHE_KEY = 'agriconnect-serviceability';
const CACHE_TTL_MS = 5 * 60_000;

function normalizedLocation(location: DeliveryLocation): DeliveryLocation {
  return {
    city: location.city.trim().toLocaleLowerCase(),
    state: location.state.trim().toLocaleLowerCase(),
    pinCode: location.pinCode.trim(),
  };
}

function readCached(location: DeliveryLocation): LocationServiceability | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as {
      location?: DeliveryLocation;
      result?: LocationServiceability;
      expiresAt?: number;
    };
    if (
      cached.expiresAt && cached.expiresAt > Date.now()
      && JSON.stringify(cached.location) === JSON.stringify(normalizedLocation(location))
      && cached.result
      && typeof cached.result.configured === 'boolean'
      && (cached.result.serviceable === true || cached.result.serviceable === false || cached.result.serviceable === null)
    ) {
      return cached.result;
    }
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Cached serviceability could not be read.', error);
  }
  return null;
}

export function cacheLocationServiceability(location: DeliveryLocation, result: LocationServiceability): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      location: normalizedLocation(location),
      result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }));
  } catch (error) {
    console.warn('Serviceability result could not be cached.', error);
  }
}

export async function getLocationServiceability(
  location: DeliveryLocation,
  options: { useCache?: boolean } = {},
): Promise<LocationServiceability> {
  if (options.useCache !== false) {
    const cached = readCached(location);
    if (cached) return cached;
  }
  const params = new URLSearchParams({
    city: location.city.trim(),
    state: location.state.trim(),
    pinCode: location.pinCode.trim(),
  });
  const result = await request<LocationServiceability>(`/serviceability?${params}`);
  if (options.useCache !== false) cacheLocationServiceability(location, result);
  return result;
}
