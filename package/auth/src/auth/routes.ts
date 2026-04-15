import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import {
  buildAuthPresenceClearCookie,
  buildAuthPresenceSetCookie,
} from "./auth-presence";
import { provisionUserOnServer } from "../provisioning/provision";
import { verifyTurnstileToken } from "../utils/turnstileUtils";
import { AuthPolicyError } from "./errors";
import { auth } from "./instance";
import { prisma } from "./prisma";
import { enforceInternalTokenSurface } from "./token-boundary";

const openIdMetadataHandler = oauthProviderOpenIdConfigMetadata(auth);
const authServerMetadataHandler = oauthProviderAuthServerMetadata(auth);

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

function isVerifyEmailPath(pathname: string): boolean {
  return pathname.includes("/verify-email");
}

function isSendVerificationOTPPath(pathname: string): boolean {
  return pathname.includes("/email-otp/send-verification-otp");
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

    if (body?.turnstileToken) {
      const turnstileResult = await verifyTurnstileToken(body.turnstileToken);
      if (!turnstileResult.success) {
        return toJsonError(
          403,
          "TURNSTILE_FAILED",
          "Turnstile verification failed",
        );
      }
    }
  }

  const response = await auth.handler(request);

  if (response.ok && (isVerifyEmailPath(pathname) || pathname.includes("/email-otp/verify-email"))) {
    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as {
        user?: { id?: string; name?: string };
      };
      if (body.user?.id) {
        // Only provision if UserProfile exists (identity step complete)
        const profile = await prisma.userProfile.findUnique({
          where: { userId: body.user.id },
          select: { slug: true },
        });
        if (profile) {
          await provisionUserOnServer({
            unitId: body.user.id,
            slug: profile.slug,
            name: body.user.name ?? "",
          });
        }
      }
    } catch (error) {
      // Best-effort: exchange fallback will handle if this fails
      console.error("[verify-email] Provisioning after verification failed:", error);
    }
  }

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
  return openIdMetadataHandler(request);
}

export async function handleOAuthAuthorizationServerRequest(
  request: Request,
): Promise<Response> {
  return authServerMetadataHandler(request);
}
