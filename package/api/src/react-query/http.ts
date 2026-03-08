import {env} from '@package/app/env';
import type {AuthTokenResponse} from '@package/contract';

/**
 * Base API URL - should be configured via environment
 */
const API_BASE_URL = env.VITE_API_URL || 'http://localhost:4000';
const AUTH_BASE_URL = env.VITE_AUTH_API_URL || 'http://localhost:3001';
const AUTH_STORE_KEY = 'auth-store';
export const AUTH_TOKEN_STORAGE_EVENT = 'package-auth-token-storage';

/**
 * JWT Token Storage Keys
 */
type PersistedAuthSnapshot = {
  state?: {
    accessToken?: string | null;
    isAuthenticated?: boolean;
  };
  version?: number;
};

function readAuthSnapshot(): PersistedAuthSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_STORE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedAuthSnapshot;
  } catch {
    return null;
  }
}

function writeAuthSnapshot(token: string | null): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    AUTH_STORE_KEY,
    JSON.stringify({
      state: {
        accessToken: token,
        isAuthenticated: !!token,
      },
      version: 0,
    }),
  );
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: {token},
    }),
  );
}

/**
 * Get JWT token from localStorage
 */
export const getToken = (): string | null => {
  return readAuthSnapshot()?.state?.accessToken ?? null;
};

/**
 * Set JWT token to localStorage
 */
export const setToken = (token: string | null): void => {
  if (token) {
    writeAuthSnapshot(token);
  } else {
    removeToken();
  }
};

/**
 * Remove JWT token from localStorage
 */
export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_STORE_KEY);
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: {token: null},
    }),
  );
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export interface JwtPayload {
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf-8');
  }
  throw new Error('No base64 decoder available');
}

/**
 * Parse JWT payload
 */
export function parseJwt<T extends JwtPayload = JwtPayload>(
  token?: string | null,
): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    const payload = decodeBase64Url(payloadPart);
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function buildHeaders(
  options?: globalThis.RequestInit,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }
  return headers;
}

export async function refreshAuthToken() {
  const refreshTokenResponse = await fetch(`${AUTH_BASE_URL}/api/auth/token`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const json =
    (await refreshTokenResponse.json()) as Partial<AuthTokenResponse>;
  const token = json.token ?? null;
  if (!token) {
    throw new Error('Unauthorized - Please login again');
  }
  setToken(token);
}

/**
 * Generic fetch wrapper with error handling and JWT support
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: globalThis.RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = buildHeaders(options);
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: headers,
  });

  let responseJson = await response.json();

  // Handle 401 Unauthorized - token might be expired
  if (response.status === 401) {
    if (responseJson?.message?.includes('No authorization')) {
      throw new Error(
        JSON.stringify({
          status: response?.status,
          message: responseJson?.message,
        }),
      );
    }
    console.log('Auto refresh token');
    await refreshAuthToken();
    console.log(`Auto retry ${url}`);
    const newHeaders = buildHeaders(options);
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: newHeaders,
    });
    responseJson = await response.json();
  }

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response?.status,
        message: responseJson?.message,
      }),
    );
  }

  return responseJson;
}
