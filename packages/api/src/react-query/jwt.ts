import { getApiConfig } from "../config";
import { clearAuthPresence, hasAuthPresence } from "./authPresence";

export const MAIN_SESSION_REGISTRATION_INCOMPLETE_CODES = new Set([
  "REGISTRATION_INCOMPLETE",
  "MAIN_USER_NOT_READY",
]);

export class MainSessionRefreshError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "MainSessionRefreshError";
  }
}

function getAuthBaseUrl(): string {
  return getApiConfig().authBaseUrl;
}

async function readRefreshError(response: Response): Promise<{
  code?: string;
  message: string;
}> {
  const json = await response.json().catch(() => null);
  const error = json?.error;
  if (error && typeof error === "object") {
    return {
      code: typeof error.code === "string" ? error.code : undefined,
      message:
        typeof error.message === "string" ? error.message : response.statusText,
    };
  }

  return { message: response.statusText };
}

async function postSessionRefresh(): Promise<Response> {
  return fetch(`${getAuthBaseUrl()}/auth/session/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function queryAccessToken(options?: {
  requirePresence?: boolean;
}): Promise<boolean> {
  if (options?.requirePresence !== false && !hasAuthPresence()) {
    return false;
  }

  const response = await postSessionRefresh();

  if (!response.ok) {
    const error = await readRefreshError(response);
    if (
      !error.code ||
      !MAIN_SESSION_REGISTRATION_INCOMPLETE_CODES.has(error.code)
    ) {
      clearAuthPresence();
    }
    throw new MainSessionRefreshError(
      error.message || "Unauthorized - Please login again",
      response.status,
      error.code,
    );
  }
  return true;
}

/**
 * Refresh the main rezics session cookie from the opaque auth session cookie.
 */
export async function exchangeForSessionToken(): Promise<boolean> {
  const response = await postSessionRefresh();

  if (!response.ok) {
    const error = await readRefreshError(response);
    if (
      !error.code ||
      !MAIN_SESSION_REGISTRATION_INCOMPLETE_CODES.has(error.code)
    ) {
      clearAuthPresence();
    }
    return false;
  }

  return true;
}
