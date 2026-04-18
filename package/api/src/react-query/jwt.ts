import {
  type AuthSessionTokenClaims,
  type AuthTokenResponse,
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
  normalizedTokenTransportMap,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";

const DEFAULT_TOKEN_STORAGE_KEYS: Record<string, string> = {
  [NormalizedTokenName.AUTH_SESSION]: NormalizedTokenName.AUTH_SESSION,
  [NormalizedTokenName.REZICS_SESSION]: NormalizedTokenName.REZICS_SESSION,
};

export const AUTH_TOKEN_STORAGE_EVENT = "package-auth-token-storage";
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
  storeKeyByToken: Partial<Record<NormalizedTokenNameType, string>>;
};

let tokenStrategy: JwtTokenStrategy = {
  authBaseUrl: "",
  storeKeyByToken: {
    ...DEFAULT_TOKEN_STORAGE_KEYS,
  },
};

function getAuthBaseUrl(): string {
  return tokenStrategy.authBaseUrl || getApiConfig().authBaseUrl;
}

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
    },
  };
}

export function getJwtTokenStrategy(): JwtTokenStrategy {
  return {
    authBaseUrl: getAuthBaseUrl(),
    storeKeyByToken: { ...tokenStrategy.storeKeyByToken },
  };
}

/**
 * Read the currently persisted token value for a normalized token type.
 */
function readStoredToken(tokenName: NormalizedTokenNameType): string | null {
  const storeKey = getStoreKey(tokenName);
  if (!storeKey) return null;
  return readAuthSnapshot(storeKey)?.state?.accessToken ?? null;
}

function getStoreKey(tokenName: NormalizedTokenNameType): string | undefined {
  return tokenStrategy.storeKeyByToken[tokenName];
}

function readAuthSnapshot(storeKey: string): PersistedAuthSnapshot | null {
  if (typeof window === "undefined") return null;
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
  if (typeof window === "undefined") return;

  const storeKey = getStoreKey(tokenName);
  if (!storeKey) return;

  const payload = parseJwt(token);
  localStorage.setItem(
    storeKey,
    JSON.stringify({
      state: {
        accessToken: token,
        id: payload?.id ?? null,
        slug: payload?.slug ?? null,
        role: payload?.role ?? null,
        isAuthenticated: !!token,
        ...(payload?.email_verified === false ? { email_verified: false } : {}),
      },
      version: 0,
    }),
  );
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: { tokenName, token },
    }),
  );
}

/**
 * Get JWT token from localStorage
 */
export const getToken = (
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
): string | null => {
  return readStoredToken(tokenName);
};

/**
 * Set JWT token to localStorage
 */
export const setToken = (
  token: string | null,
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
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
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
): void => {
  if (typeof window === "undefined") return;
  const storeKey = getStoreKey(tokenName);
  if (!storeKey) return;
  localStorage.removeItem(storeKey);
  window.dispatchEvent(
    new CustomEvent(AUTH_TOKEN_STORAGE_EVENT, {
      detail: { tokenName, token: null },
    }),
  );
};

/**
 * Check if user is authenticated (has a valid session token)
 */
export const isAuthenticated = (): boolean => {
  return !!getToken(NormalizedTokenName.REZICS_SESSION);
};

export async function queryAccessToken(options?: {
  requirePresence?: boolean;
}) {
  if (options?.requirePresence !== false && !hasAuthPresence()) {
    return null;
  }

  const refreshTokenResponse = await fetch(
    `${getAuthBaseUrl()}/api/auth/token`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  const json =
    (await refreshTokenResponse.json()) as Partial<AuthTokenResponse>;
  const token = json.token ?? null;
  if (!token) {
    clearAuthPresence();
    throw new Error("Unauthorized - Please login again");
  }
  setToken(token, NormalizedTokenName.AUTH_SESSION);
  return token;
}

/**
 * Ensure an auth session JWT exists in client storage, using the auth
 * session cookie to mint one when needed.
 */
export async function ensureAuthSessionToken(options?: {
  requirePresence?: boolean;
}) {
  const existingToken = getToken(NormalizedTokenName.AUTH_SESSION);
  if (existingToken) {
    return existingToken;
  }

  return queryAccessToken(options);
}

/**
 * Exchange an auth-session-token for a rezics-session-token via
 * the server's POST /session/exchange endpoint.
 */
export async function exchangeForSessionToken(): Promise<string | null> {
  const authToken = getToken(NormalizedTokenName.AUTH_SESSION);
  if (!authToken) return null;

  const claims = parseJwt(authToken);
  if (claims?.email_verified === false) return null;

  const { apiBaseUrl } = getApiConfig();
  const response = await fetch(`${apiBaseUrl}/session/exchange`, {
    method: "POST",
    headers: {
      "x-auth-session-token": authToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as { token?: string };
  const token = json.token ?? null;
  if (token) {
    setToken(token, NormalizedTokenName.REZICS_SESSION);
  }
  return token;
}

/**
 * Build transport-correct headers for API calls.
 * Authorization: Bearer always carries the REZICS_SESSION token.
 */
export function buildTokenHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const sessionToken = readStoredToken(NormalizedTokenName.REZICS_SESSION);
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  return headers;
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
  ).map((tokenName) => getTokenRecord(tokenName));
}

export function clearAllTokens(): void {
  const managedTokens = Object.keys(
    tokenStrategy.storeKeyByToken,
  ) as NormalizedTokenNameType[];
  managedTokens.forEach((tokenName) => {
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
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf-8");
  }
  throw new Error("No base64 decoder available");
}

/**
 * Parse JWT payload
 */
export function parseJwt<T extends JwtPayload = JwtPayload>(
  token?: string | null,
): T | null {
  if (!token) return null;
  const parts = token.split(".");
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

export function getAuthSessionClaims(): AuthSessionTokenClaims | null {
  return getParsedToken<AuthSessionTokenClaims>(
    NormalizedTokenName.AUTH_SESSION,
  );
}

export function getRezicsSessionClaims(): RezicsSessionClaims | null {
  return getParsedToken<RezicsSessionClaims>(
    NormalizedTokenName.REZICS_SESSION,
  );
}
