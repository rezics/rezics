import { treaty } from "@elysiajs/eden";
import type {
  AuthAdminEmailRouter,
  AuthAdminRouter,
  AuthSignInRouter,
} from "@rezics/backend/auth";
import type { AuthJwtServiceAdminRouter } from "@rezics/backend/auth/jwt";
import type { ServerApp } from "@rezics/backend/server";
import {
  ApiError,
  type ApiErrorDetail,
  type EdenResponse,
} from "@rezics/contract";
import type { AnyElysia } from "elysia";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export function createEdenClient<App extends AnyElysia>(
  baseUrl = API_BASE_URL,
) {
  return treaty<App>(baseUrl, {
    fetch: {
      credentials: "include",
    },
  });
}

export const apiClient = createEdenClient<ServerApp>();
export const authAdminClient =
  createEdenClient<AuthAdminRouter>(`${API_BASE_URL}/auth`);
export const authAdminEmailClient =
  createEdenClient<AuthAdminEmailRouter>(`${API_BASE_URL}/auth`);
export const authJwtServiceClient =
  createEdenClient<AuthJwtServiceAdminRouter>(`${API_BASE_URL}/auth`);
export const authSignInClient =
  createEdenClient<AuthSignInRouter>(`${API_BASE_URL}/auth`);

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

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export async function unwrapEdenProxyResponse<T>(
  response: unknown,
): Promise<T> {
  const data = unwrapEdenResponse(
    response as EdenResponse<Response | T>,
  );
  if (!(data instanceof Response)) return data as T;

  const payload = await data.json().catch(() => null);
  if (data.ok) return payload as T;

  const payloadRecord = getRecord(payload);
  const errorRecord = getRecord(payloadRecord?.error);
  const code =
    typeof errorRecord?.code === "string" ? errorRecord.code : "UNKNOWN";
  const message =
    typeof payloadRecord?.message === "string"
      ? payloadRecord.message
      : typeof errorRecord?.message === "string"
        ? errorRecord.message
        : data.statusText || "Request failed";

  throw new ApiError(data.status, code, message);
}
