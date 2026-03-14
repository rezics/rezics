import {NormalizedTokenName, normalizedTokenTransportMap} from '@package/contract';
import {env} from '../env';
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
  const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const rezicsSessionToken = getToken(NormalizedTokenName.REZICS_SESSION);
  if (rezicsSessionToken) {
    headers[normalizedTokenTransportMap[NormalizedTokenName.REZICS_SESSION].headerName] =
      rezicsSessionToken;
  }
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }
  return headers;
}

async function requestWithAuthRetry(
  url: string,
  options?: globalThis.RequestInit,
): Promise<Response> {
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  });

  if (response.status !== 401) {
    return response;
  }

  const cloned = response.clone();
  const responseJson = await cloned.json().catch(() => null);

  if (responseJson?.message?.includes('No authorization') || !hasAuthPresence()) {
    return response;
  }

  try {
    await queryAccessToken();
  } catch {
    clearAuthPresence();
    return response;
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildHeaders(options),
  });
}

export async function apiFetchResponse<T>(
  endpoint: string,
  options?: globalThis.RequestInit,
): Promise<{data: T; response: Response}> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await requestWithAuthRetry(url, options);
  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response?.status,
        message: responseJson?.message,
      }),
    );
  }

  return {
    data: responseJson as T,
    response,
  };
}

/**
 * Generic fetch wrapper with error handling and JWT support
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: globalThis.RequestInit,
): Promise<T> {
  const {data} = await apiFetchResponse<T>(endpoint, options);
  return data;
}
