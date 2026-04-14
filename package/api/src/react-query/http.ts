import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";
import {
  buildTokenHeaders,
  exchangeForSessionToken,
  queryAccessToken,
} from "./jwt";

/**
 * Base API URL - should be configured via environment
 */
function getApiBaseUrl(): string {
  return getApiConfig().apiBaseUrl;
}

export type ApiRequestInit = globalThis.RequestInit;

/**
 * Build request headers for business API calls.
 * Authorization: Bearer always carries the rezics-session-token.
 */
function buildHeaders(options?: ApiRequestInit): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(options?.headers).entries()),
    ...buildTokenHeaders(),
  };
}

async function requestWithAuthRetry(
  url: string,
  options?: ApiRequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: buildHeaders(options),
  });

  if (response.status !== 401) {
    return response;
  }

  const cloned = response.clone();
  const responseJson = await cloned.json().catch(() => null);

  if (
    responseJson?.message?.includes("No authorization header") ||
    !hasAuthPresence()
  ) {
    return response;
  }

  // Try refreshing: get a new auth-identity-token, then exchange for session token
  try {
    await queryAccessToken();
    await exchangeForSessionToken();
  } catch {
    clearAuthPresence();
    return response;
  }

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: buildHeaders(options),
  });
}

export async function apiFetchResponse<T>(
  endpoint: string,
  options?: ApiRequestInit,
): Promise<{ data: T; response: Response }> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const response = await requestWithAuthRetry(url, options);
  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response.status,
        message: responseJson?.message ?? response.statusText,
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
  const { data } = await apiFetchResponse<T>(endpoint, options);
  return data;
}
