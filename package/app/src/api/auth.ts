import { z } from "zod";

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------

/**
 * Where the API server lives.  Falls back to localhost when env is absent.
 */
const API_BASE_URL = (typeof process !== "undefined"
  && process.env["NEXT_PUBLIC_API_BASE_URL"])
  || "http://localhost:3333";

// ------------------------------------------------------------------
// Schema definitions (runtime validation with zod)
// ------------------------------------------------------------------

const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

// ------------------------------------------------------------------
// Storage helpers
// ------------------------------------------------------------------

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const getAccessToken = (): string | null =>
  (typeof window !== "undefined"
    && window.localStorage.getItem(ACCESS_TOKEN_KEY))
  || null;

export const setAccessToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

export const getRefreshToken = (): string | null =>
  (typeof window !== "undefined"
    && window.localStorage.getItem(REFRESH_TOKEN_KEY))
  || null;

export const setRefreshToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

// ------------------------------------------------------------------
// Network helpers
// ------------------------------------------------------------------

/**
 * Performs a login request.  Resolves to `true` when successful.
 */
export const login = async (
  email: string,
  password: string,
): Promise<boolean> => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) return false;

  const json = await res.json();
  const { accessToken, refreshToken } = TokenResponseSchema.parse(json);
  setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);
  return true;
};

export const logout = () => {
  setAccessToken(null);
  setRefreshToken(null);
};

/**
 * Attempts to refresh the JWT using the persisted refresh token.
 * Returns the new access token when successful, otherwise `null`.
 */
export const refreshToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = TokenResponseSchema.parse(json);

    setAccessToken(newAccessToken);
    if (newRefreshToken) setRefreshToken(newRefreshToken);

    return newAccessToken;
  } catch {
    return null;
  }
};
