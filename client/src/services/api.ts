import { API_BASE_URL, AppConfig } from '@/config/app';
import type { AuthSession, User } from '@/types';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    let code: string | undefined;
    try {
      const body = await res.json();
      const serverMessage = body.message;
      code = typeof body.code === 'string' ? body.code : undefined;
      message = typeof serverMessage === 'string' && serverMessage.trim().startsWith('[')
        ? 'Please check your details and try again.'
        : serverMessage ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }
  return (await res.json()) as T;
}

interface AuthResponse {
  token: string;
  user: Partial<User> & { email: string; name?: string };
}

interface RegistrationResponse {
  success: boolean;
  message: string;
  email: string;
  otpSent: boolean;
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

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async resendEmailVerification(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/verification/email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resendOtp(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyOtp(email: string, otp: string): Promise<AuthSession> {
    const response = await request<AuthResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
    return { token: response.token, user: AuthService.mapUser(response.user) };
  },

  async confirmEmailVerification(token: string): Promise<{ email: string; emailVerified: boolean }> {
    return request<{ email: string; emailVerified: boolean }>('/auth/verification/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async register(payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role: Exclude<User['role'], 'admin'>;
    farm?: {
      farmName: string;
      village: string;
      district: string;
      state: string;
      pinCode: string;
    };
  }): Promise<RegistrationResponse> {
    if (!AppConfig.isBackendConfigured) {
      throw new ApiError(
        'Backend not configured. Registration requires VITE_API_BASE_URL to be set.',
        0
      );
    }
    return request<RegistrationResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.fullName,
        email: payload.email,
        password: payload.password,
        ...(payload.phone ? { phone: payload.phone } : {}),
        role: payload.role,
        ...(payload.farm ? { farm: payload.farm } : {}),
      }),
    });
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
      ...(u.status ? { status: u.status } : {}),
      ...(typeof u.isVerified === 'boolean' ? { isVerified: u.isVerified } : {}),
      ...(typeof u.emailVerified === 'boolean' ? { emailVerified: u.emailVerified } : {}),
      ...(u.requestedFarm ? { requestedFarm: u.requestedFarm } : {}),
      ...(u.address ? { address: u.address } : {}),
    };
  },
};
