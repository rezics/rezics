import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@rezics/contract';
import {getApiConfig} from '../config';
import {clearAuthPresence, hasAuthPresence} from './authPresence';
import {
  buildTokenHeaders,
  queryAccessToken,
} from './jwt';

/**
 * Base API URL - should be configured via environment
 */
function getApiBaseUrl(): string {
  return getApiConfig().apiBaseUrl;
}

export type ApiRequestInit = globalThis.RequestInit & {
  includeTokens?: NormalizedTokenNameType[];
};

/**
 * Build request headers for business API calls using the normalized token
 * transport contract. Caller-provided headers are preserved, but managed
 * auth transports always win when present.
 */
function buildHeaders(
  options?: ApiRequestInit,
): Record<string, string> {
  const headers = {
    'Content-Type': 'application/json',
    ...Object.fromEntries(new Headers(options?.headers).entries()),
    ...buildTokenHeaders({
      include: options?.includeTokens ?? [
        NormalizedTokenName.AUTH_IDENTITY,
        NormalizedTokenName.REZICS_SESSION,
      ],
    }),
  };

  return headers;
}

async function requestWithAuthRetry(
  url: string,
  options?: ApiRequestInit,
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

  if (responseJson?.message?.includes('No authorization header') || !hasAuthPresence()) {
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
  options?: ApiRequestInit,
): Promise<{data: T; response: Response}> {
  const url = `${getApiBaseUrl()}${endpoint}`;
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
  options?: ApiRequestInit,
): Promise<T> {
  const {data} = await apiFetchResponse<T>(endpoint, options);
  return data;
}
