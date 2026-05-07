import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import { verifyTurnstileToken } from "../utils/turnstileUtils";
import { env } from "../env";
import {
  buildAuthPresenceClearCookie,
  buildAuthPresenceSetCookie,
} from "./auth-presence";
import { AuthPolicyError } from "./errors";
import { auth } from "./instance";
import { enforceInternalTokenSurface } from "./token-boundary";

const openIdMetadataHandler = oauthProviderOpenIdConfigMetadata(auth);
const authServerMetadataHandler = oauthProviderAuthServerMetadata(auth);

function rewritePublicMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    const internalPrefix = `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth`;
    const publicPrefix = env.AUTH_PUBLIC_BASE_URL.replace(/\/$/, "");
    if (value.startsWith(internalPrefix)) {
      return `${publicPrefix}${value.slice(internalPrefix.length)}`;
    }
    if (value === env.BETTER_AUTH_URL) {
      return env.AUTH_PUBLIC_ISSUER_URL;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(rewritePublicMetadataValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        rewritePublicMetadataValue(entry),
      ]),
    );
  }

  return value;
}

async function rewritePublicMetadataResponse(
  response: Response,
): Promise<Response> {
  if (!response.ok) {
    return response;
  }

  const metadata = (await response.json()) as Record<string, unknown>;
  const rewritten = rewritePublicMetadataValue(metadata) as Record<
    string,
    unknown
  >;

  rewritten.issuer = env.AUTH_PUBLIC_ISSUER_URL;
  rewritten.jwks_uri = new URL(
    "/auth/session/jwks",
    env.AUTH_PUBLIC_BASE_URL,
  ).toString();

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");

  return Response.json(rewritten, {
    status: response.status,
    headers,
  });
}

function toJsonError(status: number, code: string, message: string): Response {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function toVerificationError(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds?: number,
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      },
    },
    { status },
  );
}

function isSessionEstablishingPath(pathname: string): boolean {
  return (
    pathname.includes("/sign-in") ||
    pathname.includes("/oauth/callback") ||
    pathname.endsWith("/token") ||
    pathname.includes("/email-otp/verify-email")
  );
}

function isSessionClearingPath(pathname: string): boolean {
  return pathname.endsWith("/sign-out") || pathname.endsWith("/revoke-session");
}

function isSendVerificationOTPPath(pathname: string): boolean {
  return pathname.includes("/email-otp/send-verification-otp");
}

function isVerifyEmailOTPPath(pathname: string): boolean {
  return pathname.includes("/email-otp/verify-email");
}

function isSendVerificationEmailPath(pathname: string): boolean {
  return pathname.includes("/send-verification-email");
}

function isVerificationPath(pathname: string): boolean {
  return (
    isSendVerificationOTPPath(pathname) ||
    isVerifyEmailOTPPath(pathname) ||
    isSendVerificationEmailPath(pathname)
  );
}

function isSessionCheckPath(pathname: string): boolean {
  return (
    pathname.endsWith("/token") ||
    pathname.endsWith("/get-session") ||
    pathname.endsWith("/get-session-state")
  );
}

function withCookie(response: Response, cookie: string): Response {
  const nextHeaders = new Headers(response.headers);
  nextHeaders.append("set-cookie", cookie);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

function extractRetryAfterSeconds(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  if (typeof record.message === "string") return record.message;

  return fallback;
}

function getErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;

  const record = body as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  const error = record.error;
  if (error && typeof error === "object") {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }

  return undefined;
}

function mapVerificationErrorCode(
  response: Response,
  body: unknown,
): { code: string; message: string; retryAfterSeconds?: number } {
  const message = getErrorMessage(body, response.statusText);
  const bodyCode = getErrorCode(body);
  const lower = `${bodyCode ?? ""} ${message}`.toLowerCase();

  if (bodyCode === "TURNSTILE_FAILED") {
    return { code: "TURNSTILE_FAILED", message };
  }
  if (response.status === 429 || lower.includes("cooldown")) {
    return {
      code: "COOLDOWN",
      message: message || "Please wait before requesting another code",
      retryAfterSeconds: extractRetryAfterSeconds(response),
    };
  }
  if (lower.includes("expired")) {
    return { code: "EXPIRED_OTP", message };
  }
  if (lower.includes("invalid")) {
    return { code: "INVALID_OTP", message };
  }
  if (lower.includes("already") && lower.includes("verified")) {
    return { code: "ALREADY_VERIFIED", message };
  }
  if (lower.includes("email") && lower.includes("missing")) {
    return { code: "MISSING_EMAIL", message };
  }
  if (response.status === 401) {
    return { code: "UNAUTHORIZED", message };
  }

  return {
    code: "DELIVERY_FAILED",
    message: message || "Verification message could not be delivered",
  };
}

async function normalizeVerificationResponse(
  response: Response,
  pathname: string,
): Promise<Response> {
  if (!isVerificationPath(pathname) || response.ok) {
    return response;
  }

  const body = await response
    .clone()
    .json()
    .catch(() => null);
  const error = mapVerificationErrorCode(response, body);
  return toVerificationError(
    response.status,
    error.code,
    error.message,
    error.retryAfterSeconds,
  );
}

export async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    enforceInternalTokenSurface(request);
  } catch (error) {
    if (error instanceof AuthPolicyError) {
      return toJsonError(error.status, error.code, error.message);
    }

    return toJsonError(
      500,
      "AUTH_POLICY_ERROR",
      "Unexpected auth policy error",
    );
  }

  const requestUrl = new URL(request.url);
  const { pathname } = requestUrl;

  if (isSendVerificationOTPPath(pathname) && request.method === "POST") {
    const cloned = request.clone();
    let body: { turnstileToken?: string } | undefined;
    try {
      body = await cloned.json();
    } catch {
      return toJsonError(400, "INVALID_REQUEST", "Invalid request body");
    }

    if (!body?.turnstileToken) {
      return toVerificationError(
        403,
        "TURNSTILE_FAILED",
        "Turnstile verification is required",
      );
    }

    const turnstileResult = await verifyTurnstileToken(body.turnstileToken);
    if (!turnstileResult.success) {
      return toVerificationError(
        403,
        "TURNSTILE_FAILED",
        "Turnstile verification failed",
      );
    }
  }

  let response: Response;
  try {
    response = await auth.handler(request);
  } catch (error) {
    if (isVerificationPath(pathname)) {
      console.error("[verification] Auth handler failed:", error);
      return toVerificationError(
        502,
        "DELIVERY_FAILED",
        "Verification message could not be delivered",
      );
    }

    throw error;
  }

  response = await normalizeVerificationResponse(response, pathname);

  if (response.ok && isSessionEstablishingPath(pathname)) {
    return withCookie(response, buildAuthPresenceSetCookie(requestUrl));
  }

  if (response.ok && isSessionClearingPath(pathname)) {
    return withCookie(response, buildAuthPresenceClearCookie(requestUrl));
  }

  if (
    (response.status === 401 || response.status === 403) &&
    isSessionCheckPath(pathname)
  ) {
    return withCookie(response, buildAuthPresenceClearCookie(requestUrl));
  }

  return response;
}

export async function handleJwksCompatibilityRequest(
  request: Request,
): Promise<Response> {
  void request;
  const { getAuthSessionJwksResponse } = await import("../session/jwt/routes");
  return getAuthSessionJwksResponse();
}

export async function handleOpenIdConfigRequest(
  request: Request,
): Promise<Response> {
  return rewritePublicMetadataResponse(await openIdMetadataHandler(request));
}

export async function handleOAuthAuthorizationServerRequest(
  request: Request,
): Promise<Response> {
  return rewritePublicMetadataResponse(
    await authServerMetadataHandler(request),
  );
}
