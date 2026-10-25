export interface Session {
  token: string;
  user: { id: string; email: string; name: string; role: string; phone?: string };
}

export interface Product {
  _id: string;
  cropName: string;
  category: string;
  unit: string;
  pricePerUnitPaise: number;
  availableQuantity: number;
  farmerId?: { name?: string };
  location?: { district?: string; state?: string };
  images?: string[];
}

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_API_URL = 'https://agriconnect-api-ajoq.onrender.com/api';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const apiUrl = (configuredApiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
const apiBaseUrl = /\/api$/i.test(apiUrl) ? apiUrl : `${apiUrl}/api`;

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
  if (!response.ok) throw new ApiError(body.message || `Request failed (${response.status}).`, body.code);
  return body as T;
}

export function getApiError(error: unknown): string {
  if (error instanceof Error && error.message === 'Network request failed') {
    return 'Could not reach AgriConnect. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
