export interface Session {
  token: string;
  user: { id: string; email: string; name: string; role: string };
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

const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  if (!apiUrl) throw new Error('Set EXPO_PUBLIC_API_BASE_URL in mobile/.env to connect to AgriConnect.');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status}).`);
  return body as T;
}

export function getApiError(error: unknown): string {
  if (error instanceof Error && error.message === 'Network request failed') {
    return 'Could not reach AgriConnect. Check your connection and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
