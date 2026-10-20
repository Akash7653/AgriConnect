import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthService, request } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import type { AuthSession, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isBackendConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
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
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.loadSession());
  const { showToast } = useToast();

  useEffect(() => {
    const s = AuthService.loadSession();
    setSession(s);
  }, []);

  useEffect(() => {
    if (!session || isAddressSaved(session.user.address)) return;

    const attemptKey = `agriconnect_location_attempted:${session.user.id}`;
    if (localStorage.getItem(attemptKey)) return;

    localStorage.setItem(attemptKey, 'true');
    if (!navigator.geolocation) {
      showToast('Location is unavailable in this browser. You can add your address manually.', 'info');
      return;
    }

    showToast('We’ll use your location once to save your area to your account. Your browser may ask for permission.', 'info');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await request<{ address: { city: string; district: string; state: string; pinCode: string } }>(
            '/location/reverse-geocode',
            {
              method: 'POST',
              body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
            }
          );
          const address = {
            villageOrCity: result.address.city,
            district: result.address.district,
            state: result.address.state,
            pinCode: result.address.pinCode,
          };
          await request('/auth/profile', {
            method: 'PUT',
            token: session.token,
            body: JSON.stringify({ address }),
          });

          const currentSession = AuthService.loadSession();
          if (currentSession?.token !== session.token) return;
          const updatedSession = {
            ...session,
            user: { ...session.user, address: { ...session.user.address, ...address } },
          };
          AuthService.persistSession(updatedSession);
          setSession(updatedSession);
          showToast(`Location saved as ${result.address.city}, ${result.address.state}.`, 'success');
        } catch (error) {
          showToast(
            error instanceof Error
              ? `Could not save your location: ${error.message}. You can enter your address manually.`
              : 'Could not save your location. You can enter your address manually.',
            'error'
          );
        }
      },
      (error) => {
        showToast(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can enter your address manually.'
            : 'Could not detect your location. You can enter your address manually.',
          'info'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [session, showToast]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      isBackendConfigured: AuthService.isBackendConfigured,
      async signIn(email, password) {
        const s = await AuthService.login(email, password);
        AuthService.persistSession(s);
        setSession(s);
      },
      async signUp(payload) {
        const s = await AuthService.register(payload);
        AuthService.persistSession(s);
        setSession(s);
      },
      signOut() {
        AuthService.clearSession();
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function isAddressSaved(address: User['address']): boolean {
  return Boolean(address?.villageOrCity && address.state && address.pinCode);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
