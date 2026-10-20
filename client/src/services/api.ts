import { API_BASE_URL, AppConfig } from '@/config/app';
import type { AuthSession, User } from '@/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  token?: string;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const url = `${API_BASE_URL}${path}`;
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...rest, headers: mergedHeaders });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      const serverMessage = body.message;
      message = typeof serverMessage === 'string' && serverMessage.trim().startsWith('[')
        ? 'Please check your details and try again.'
        : serverMessage ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

interface AuthResponse {
  token: string;
  user: Partial<User> & { email: string; name?: string };
}

export const AuthService = {
  isBackendConfigured: AppConfig.isBackendConfigured,

  async login(email: string, password: string): Promise<AuthSession> {
    if (!AppConfig.isBackendConfigured) {
      throw new ApiError(
        'Backend not configured. Authentication requires VITE_API_BASE_URL to be set.',
        0
      );
    }
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return { token: response.token, user: AuthService.mapUser(response.user) };
  },

  async register(payload: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    role: Exclude<User['role'], 'admin'>;
    farm?: {
      farmName: string;
      village: string;
      district: string;
      state: string;
      pinCode: string;
    };
  }): Promise<AuthSession> {
    if (!AppConfig.isBackendConfigured) {
      throw new ApiError(
        'Backend not configured. Registration requires VITE_API_BASE_URL to be set.',
        0
      );
    }
    const response = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.fullName,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        role: payload.role,
        ...(payload.farm ? { farm: payload.farm } : {}),
      }),
    });
    return { token: response.token, user: AuthService.mapUser(response.user) };
  },

  persistSession(session: AuthSession) {
    localStorage.setItem('agriconnect_session', JSON.stringify(session));
  },

  loadSession(): AuthSession | null {
    const raw = localStorage.getItem('agriconnect_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  },

  clearSession() {
    localStorage.removeItem('agriconnect_session');
  },

  mapUser(u: Partial<User> & { email: string; name?: string }): User {
    return {
      id: u.id ?? 'unknown',
      email: u.email,
      fullName: u.fullName ?? u.name ?? '',
      ...(u.phone ? { phone: u.phone } : {}),
      role: u.role ?? 'buyer',
      ...(u.requestedRole ? { requestedRole: u.requestedRole } : {}),
      ...(u.requestedFarm ? { requestedFarm: u.requestedFarm } : {}),
      ...(u.address ? { address: u.address } : {}),
    };
  },
};
