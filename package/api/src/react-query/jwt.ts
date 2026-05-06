import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from "@rezics/contract";
import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";

const DEFAULT_TOKEN_STORAGE_KEYS: Record<string, string> = {
  [NormalizedTokenName.AUTH_SESSION]: NormalizedTokenName.AUTH_SESSION,
  [NormalizedTokenName.REZICS_SESSION]: NormalizedTokenName.REZICS_SESSION,
};

export const AUTH_TOKEN_STORAGE_EVENT = "package-auth-token-storage";
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
  if (typeof window !== "undefined") return null;
  void tokenName;
  return null;
}

function getStoreKey(tokenName: NormalizedTokenNameType): string | undefined {
  return tokenStrategy.storeKeyByToken[tokenName];
}

function writeAuthSnapshot(
  tokenName: NormalizedTokenNameType,
  token: string | null,
): void {
  if (typeof window === "undefined") return;
  void token;
  removeToken(tokenName);
}

/**
 * Browser session credentials are httpOnly cookies, so this returns null in
 * normal web flows.
 */
export const getToken = (
  tokenName: NormalizedTokenNameType = NormalizedTokenName.AUTH_SESSION,
): string | null => {
  return readStoredToken(tokenName);
};

/**
 * Browser session credentials are not persisted in script-visible storage.
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
 * Remove any legacy script-visible token snapshot.
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
export const isAuthenticated = (): boolean => false;

export async function queryAccessToken(options?: {
  requirePresence?: boolean;
}): Promise<boolean> {
  if (options?.requirePresence !== false && !hasAuthPresence()) {
    return false;
  }

  const refreshTokenResponse = await fetch(
    `${getAuthBaseUrl()}/auth/session/refresh`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!refreshTokenResponse.ok) {
    clearAuthPresence();
    throw new Error("Unauthorized - Please login again");
  }
  return true;
}

/**
 * Ensure the main session cookie is refreshed from the opaque auth session
 * cookie.
 */
export async function ensureAuthSessionToken(options?: {
  requirePresence?: boolean;
}) {
  return queryAccessToken(options);
}

/**
 * Refresh the main rezics session cookie from the opaque auth session cookie.
 */
export async function exchangeForSessionToken(): Promise<boolean> {
  const response = await fetch(`${getAuthBaseUrl()}/auth/session/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return false;
  }

  removeToken(NormalizedTokenName.AUTH_SESSION);
  removeToken(NormalizedTokenName.REZICS_SESSION);
  return true;
}

/**
 * Build transport-correct headers for non-browser API calls.
 */
export function buildTokenHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (typeof window !== "undefined") {
    return headers;
  }

  const sessionToken = readStoredToken(NormalizedTokenName.REZICS_SESSION);
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  return headers;
}

export function clearAllTokens(): void {
  const managedTokens = Object.keys(
    tokenStrategy.storeKeyByToken,
  ) as NormalizedTokenNameType[];
  managedTokens.forEach((tokenName) => {
    removeToken(tokenName);
  });
}
