/**
 * Base API URL - should be configured via environment
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * JWT Token Storage Keys
 */
const TOKEN_KEY = 'jwt_token';

/**
 * Get JWT token from localStorage
 */
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Set JWT token to localStorage
 */
export const setToken = (token: string | null): void => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

/**
 * Remove JWT token from localStorage
 */
export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

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

  const responseJson = await response.json();
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
    const refreshTokenResponse = await fetch(
      `${API_BASE_URL}/users/refresh-token`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const json = await refreshTokenResponse.json();
    if (!json?.token) {
      throw new Error('Unauthorized - Please login again');
    }
    setToken(json.token);
    console.log(`Auto retry ${url}`);
    const newHeaders = buildHeaders(options);
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: newHeaders,
    });
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
