import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApiBaseUrl } from '@/lib/api-config';

export const AUTH_TOKEN_KEY = 'mobility_api_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

type FetchOpts = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T = unknown>(path: string, options: FetchOpts = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError(0, 'API is not configured (EXPO_PUBLIC_API_URL / extra.apiBaseUrl)');
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (!options.skipAuth) {
    const token = await getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j.detail === 'string') {
        detail = j.detail;
      } else if (Array.isArray(j.detail)) {
        detail = j.detail
          .map((d) => {
            if (typeof d === 'object' && d !== null && 'msg' in d) {
              const o = d as { msg: string; loc?: (string | number)[] };
              const path = o.loc?.filter((x) => x !== 'body').join('.') ?? '';
              return path ? `${path}: ${o.msg}` : o.msg;
            }
            return String(d);
          })
          .join('; ');
      }
    } catch {
      /* use text */
    }
    throw new ApiError(res.status, detail || res.statusText);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
