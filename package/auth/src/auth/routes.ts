import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import {
  buildAuthPresenceClearCookie,
  buildAuthPresenceSetCookie,
} from "./auth-presence";
import { AuthPolicyError } from "./errors";
import { auth } from "./instance";
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
    pathname.endsWith("/token")
  );
}

function isSessionClearingPath(pathname: string): boolean {
  return pathname.endsWith("/sign-out") || pathname.endsWith("/revoke-session");
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

  const response = await auth.handler(request);
  const { pathname } = new URL(request.url);
  const requestUrl = new URL(request.url);

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
