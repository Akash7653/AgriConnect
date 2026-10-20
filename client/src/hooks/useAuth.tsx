import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthService } from '@/services/api';
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
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.loadSession());

  useEffect(() => {
    const s = AuthService.loadSession();
    setSession(s);
  }, []);

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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
