import { treaty } from "@elysiajs/eden";
import {
  ApiError,
  type ApiErrorDetail,
  type EdenResponse,
  type StatusEdenClient,
} from "@rezics/contract/api";
import type { Elysia } from "elysia";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export function createEdenClient<App extends Elysia>(baseUrl = API_BASE_URL) {
  return treaty<App>(baseUrl, {
    fetch: {
      credentials: "include",
    },
  });
}

export const apiClient = treaty<any>(API_BASE_URL, {
  fetch: {
    credentials: "include",
  },
}) as unknown as StatusEdenClient;

type EdenErrorValue = {
  code?: string;
  detail?: unknown;
  message?: string;
};

function getEdenErrorValue(error: unknown): EdenErrorValue | null {
  if (!error || typeof error !== "object") return null;
  const value = "value" in error ? error.value : error;
  return value && typeof value === "object" ? (value as EdenErrorValue) : null;
}

export function unwrapEdenResponse<T>(response: EdenResponse<T>): T {
  if (response.error) {
    const value = getEdenErrorValue(response.error);
    throw new ApiError(
      response.status,
      value?.code ?? "UNKNOWN",
      value?.message ?? "Request failed",
      value?.detail as ApiErrorDetail | undefined,
    );
  }

  if (response.data === null) {
    throw new ApiError(response.status, "EMPTY_RESPONSE", "Empty response");
  }

  return response.data;
}
