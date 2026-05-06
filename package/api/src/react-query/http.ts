import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";
import { ApiError } from "./errors";
import { buildTokenHeaders, exchangeForSessionToken } from "./jwt";

/**
 * Base API URL - should be configured via environment
 */
function getApiBaseUrl(): string {
  return getApiConfig().apiBaseUrl;
}

export type ApiRequestInit = globalThis.RequestInit;

/**
 * Build request headers for business API calls.
 * Browser requests rely on httpOnly session cookies. Non-browser callers can
 * still attach a stored rezics session token through buildTokenHeaders().
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

  try {
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
    throw new ApiError(
      response.status,
      responseJson?.code ?? "UNKNOWN",
      responseJson?.message ?? response.statusText,
      responseJson?.detail,
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
