import {env} from '@package/app/env';
import {clearAuthPresence, hasAuthPresence} from './authPresence';
import {getToken, queryAccessToken} from './jwt';

/**
 * Base API URL - should be configured via environment
 */
const API_BASE_URL = env.VITE_API_URL || 'http://localhost:4000';

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
    if (!hasAuthPresence()) {
      throw new Error(
        JSON.stringify({
          status: response?.status,
          message: responseJson?.message,
        }),
      );
    }
    console.log('Auto refresh token');
    try {
      await queryAccessToken();
    } catch {
      clearAuthPresence();
      throw new Error(
        JSON.stringify({
          status: response?.status,
          message: responseJson?.message,
        }),
      );
    }
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
