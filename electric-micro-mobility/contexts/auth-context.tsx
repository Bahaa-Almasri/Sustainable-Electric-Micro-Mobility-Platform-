import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch, getStoredToken, setStoredToken } from '@/lib/api-client';
import { isApiConfigured } from '@/lib/api-config';
import type { UserRow } from '@/types/entities';

export type AuthUser = {
  id: string;
  email: string | null;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string | null;
};

export type SignUpPayload = {
  email: string;
  password: string;
  name: string;
  phone_number: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (payload: SignUpPayload) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isApiConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      const token = await getStoredToken();
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const me = await apiFetch<UserRow>('/users/me');
        if (mounted) {
          setUser({ id: me.user_id, email: me.email ?? null });
        }
      } catch {
        await setStoredToken(null);
        if (mounted) setUser(null);
      }
      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!configured) {
      return { error: new Error('API is not configured') };
    }
    try {
      const res = await apiFetch<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
        skipAuth: true,
      });
      await setStoredToken(res.access_token);
      setUser({ id: res.user_id, email: res.email ?? null });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [configured]);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    if (!configured) {
      return { error: new Error('API is not configured') };
    }
    try {
      const res = await apiFetch<TokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email.trim(),
          password: payload.password,
          name: payload.name.trim(),
          phone_number: payload.phone_number.trim(),
        }),
        skipAuth: true,
      });
      await setStoredToken(res.access_token);
      setUser({ id: res.user_id, email: res.email ?? null });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [configured]);

  const signOut = useCallback(async () => {
    await setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, configured, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
