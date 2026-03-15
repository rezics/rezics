import {env} from '../env';
import {clearAuthPresence, hasAuthPresence} from './authPresence';
import {
  NormalizedTokenName,
  type AuthContextTokenClaims,
  type AuthIdentityTokenClaims,
  type RezicsSessionTokenClaims,
  type AuthTokenResponse,
  type NormalizedTokenName as NormalizedTokenNameType,
  normalizedTokenTransportMap,
} from '@package/contract';

const AUTH_BASE_URL = env.VITE_AUTH_API_URL;
const AUTH_STORE_KEY = 'auth-store';
const DEFAULT_TOKEN_STORAGE_KEYS = {
  [NormalizedTokenName.AUTH_IDENTITY]: 'auth-store',
  [NormalizedTokenName.AUTH_CONTEXT]: 'auth-context-store',
  [NormalizedTokenName.REZICS_SESSION]: 'rezics-session-store',
  [NormalizedTokenName.NOTIFICATION_SESSION]: 'notification-session-store',
  [NormalizedTokenName.SEARCH_SESSION]: 'search-session-store',
} satisfies Record<NormalizedTokenNameType, string>;

export const AUTH_TOKEN_STORAGE_EVENT = 'package-auth-token-storage';
export const DEFAULT_AUTH_STORE_KEY = AUTH_STORE_KEY;

/**
 * Shared packages use these defaults. Consuming apps may override token storage
 * keys or auth base URL through `configureJwtTokenStrategy` without changing
 * the persisted auth-store key.
 */
type PersistedAuthSnapshot = {
  state?: {
    accessToken?: string | null;
    isAuthenticated?: boolean;
  };
  version?: number;
};

export type JwtTokenRecord = {
  tokenName: NormalizedTokenNameType;
  token: string | null;
  payload: JwtPayload | null;
};

export type JwtTokenStrategy = {
  authBaseUrl: string;
  storeKeyByToken: Record<NormalizedTokenNameType, string>;
};

let tokenStrategy: JwtTokenStrategy = {
  authBaseUrl: AUTH_BASE_URL,
  storeKeyByToken: {
    ...DEFAULT_TOKEN_STORAGE_KEYS,
  },
};

export function configureJwtTokenStrategy(
  overrides: Partial<JwtTokenStrategy> & {
    storeKeyByToken?: Partial<Record<NormalizedTokenNameType, string>>;
  },
) {
  tokenStrategy = {
    authBaseUrl: overrides.authBaseUrl ?? tokenStrategy.authBaseUrl,
    storeKeyByToken: {
      ...tokenStrategy.storeKeyByToken,
      ...overrides.storeKeyByToken,
      [NormalizedTokenName.AUTH_IDENTITY]:
        overrides.storeKeyByToken?.[NormalizedTokenName.AUTH_IDENTITY] ??
        tokenStrategy.storeKeyByToken[NormalizedTokenName.AUTH_IDENTITY] ??
        AUTH_STORE_KEY,
    },
  };
}

export function getJwtTokenStrategy(): JwtTokenStrategy {
  return {
    authBaseUrl: tokenStrategy.authBaseUrl,
    storeKeyByToken: {...tokenStrategy.storeKeyByToken},
  };
}

function getStoreKey(tokenName: NormalizedTokenNameType): string {
  return tokenStrategy.storeKeyByToken[tokenName];
}

function readAuthSnapshot(storeKey = AUTH_STORE_KEY): PersistedAuthSnapshot | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(storeKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedAuthSnapshot;
  } catch {
    return null;
  }
}

function writeAuthSnapshot(
  tokenName: NormalizedTokenNameType,
  token: string | null,
): void {
  if (typeof window === 'undefined') return;

  const payload = parseJwt(token);
  const storeKey = getStoreKey(tokenName);
  localStorage.setItem(
    storeKey,
    JSON.stringify({
      state: {
        accessToken: token,
        id: payload?.id ?? null,
        slug: payload?.slug ?? null,
        role: payload?.role ?? null,
        isAuthenticated: !!token,
      },
      version: 0,
    }),
  );
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: {tokenName, token},
    }),
  );
}

/**
 * Get JWT token from localStorage
 */
export const getToken = (
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): string | null => {
  return readAuthSnapshot(getStoreKey(tokenName))?.state?.accessToken ?? null;
};

/**
 * Set JWT token to localStorage
 */
export const setToken = (
  token: string | null,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): void => {
  if (token) {
    writeAuthSnapshot(tokenName, token);
  } else {
    removeToken(tokenName);
  }
};

/**
 * Remove JWT token from localStorage
 */
export const removeToken = (
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_IDENTITY,
): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getStoreKey(tokenName));
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: {tokenName, token: null},
    }),
  );
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getToken(NormalizedTokenName.AUTH_IDENTITY);
};

export async function queryAccessToken(options?: {requirePresence?: boolean}) {
  if (options?.requirePresence !== false && !hasAuthPresence()) {
    return null;
  }

  const refreshTokenResponse = await fetch(
    `${tokenStrategy.authBaseUrl}/api/auth/token`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const json =
    (await refreshTokenResponse.json()) as Partial<AuthTokenResponse>;
  const token = json.token ?? null;
  if (!token) {
    clearAuthPresence();
    removeToken(NormalizedTokenName.AUTH_IDENTITY);
    throw new Error('Unauthorized - Please login again');
  }
  setToken(token, NormalizedTokenName.AUTH_IDENTITY);
  return token;
}

export function getTokenRecord(
  tokenName: NormalizedTokenNameType,
): JwtTokenRecord {
  const token = getToken(tokenName);
  return {
    tokenName,
    token,
    payload: parseJwt(token),
  };
}

export function getAllTokenRecords(): JwtTokenRecord[] {
  return (
    Object.keys(normalizedTokenTransportMap) as NormalizedTokenNameType[]
  ).map(tokenName => getTokenRecord(tokenName));
}

export function clearAllTokens(): void {
  (
    Object.keys(normalizedTokenTransportMap) as NormalizedTokenNameType[]
  ).forEach(tokenName => {
    removeToken(tokenName);
  });
}

export interface JwtPayload {
  id?: string;
  unitId?: string;
  sub?: string;
  name?: string;
  avatar?: string | null;
  emailVerified?: boolean;
  verificationStatus?: string;
  slug?: string;
  role?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
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

export function getParsedToken<T extends JwtPayload = JwtPayload>(
  tokenName: NormalizedTokenNameType,
): T | null {
  return parseJwt<T>(getToken(tokenName));
}

export function getAuthIdentityClaims(): AuthIdentityTokenClaims | null {
  return getParsedToken<AuthIdentityTokenClaims>(
    NormalizedTokenName.AUTH_IDENTITY,
  );
}

export function getAuthContextClaims(): AuthContextTokenClaims | null {
  return getParsedToken<AuthContextTokenClaims>(
    NormalizedTokenName.AUTH_CONTEXT,
  );
}

export function getRezicsSessionClaims(): RezicsSessionTokenClaims | null {
  return getParsedToken<RezicsSessionTokenClaims>(
    NormalizedTokenName.REZICS_SESSION,
  );
}
