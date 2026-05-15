import { getApiConfig } from "../config";
import { ApiError, type ApiErrorDetail } from "../react-query/errors";

function getNotifyBaseUrl(): string {
  return getApiConfig().notifyBaseUrl ?? "";
}

export async function notifyFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const base = getNotifyBaseUrl();
  if (!base) {
    throw new ApiError(
      0,
      "NOTIFY_NOT_CONFIGURED",
      "@rezics/api notifyBaseUrl is not configured. Call configureApi({ notifyBaseUrl }) at app boot.",
    );
  }
  const url = `${base}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...Object.fromEntries(new Headers(options?.headers).entries()),
  };

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const body = (json ?? {}) as {
      code?: string;
      message?: string;
      detail?: ApiErrorDetail;
    };
    throw new ApiError(
      response.status,
      body.code ?? "UNKNOWN",
      body.message ?? response.statusText,
      body.detail,
    );
  }
  return json as T;
}

export function getNotifyStreamUrl(): string {
  const base = getNotifyBaseUrl();
  if (!base) return "";
  return `${base}/stream`;
}
