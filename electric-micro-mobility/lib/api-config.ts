import Constants from 'expo-constants';

import { API_BASE_URL_OVERRIDE } from '@/constants/api-config';

export function getApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = typeof extra?.apiBaseUrl === 'string' ? extra.apiBaseUrl.trim() : '';
  return (
    API_BASE_URL_OVERRIDE ||
    fromExtra ||
    (typeof process.env.EXPO_PUBLIC_API_URL === 'string' ? process.env.EXPO_PUBLIC_API_URL.trim() : '') ||
    ''
  ).replace(/\/+$/, '');
}

export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}
