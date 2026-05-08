import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";
import { ApiError } from "./errors";
import { exchangeForSessionToken } from "./jwt";

function getApiBaseUrl(): string {
  return getApiConfig().apiBaseUrl;
}

export type ApiRequestInit = globalThis.RequestInit;

function buildHeaders(options?: ApiRequestInit): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(options?.headers).entries()),
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

export async function apiFetch<T>(
  endpoint: string,
  options?: ApiRequestInit,
): Promise<T> {
  const { data } = await apiFetchResponse<T>(endpoint, options);
  return data;
}
