import { Elysia, status } from "elysia";
import { prisma } from "#/prisma/client";
import { env } from "@/env";
import { userService } from "@/user/service/user.service";
import { signRezicsSessionToken } from "@/session/jwt/jwt.service";

const AUTH_PUBLIC_PREFIX = "/auth";
const AUTH_INTERNAL_PREFIX = "/api/auth";
const SESSION_COOKIE_NAME = "rezics-session-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type AuthSessionStateResponse = {
  session?: {
    id?: string;
    token?: string;
    userId?: string;
  };
  user?: {
    id?: string;
    name?: string;
    emailVerified?: boolean;
  };
  authSession?: {
    identitySet?: boolean;
    registrationComplete?: boolean;
    readinessStatus?: string;
  };
};

function getInternalAuthBaseUrl(): string {
  return env.AUTH_INTERNAL_BASE_URL || env.AUTH_BASE_URL;
}

function getPublicAuthBaseUrl(): string {
  return env.AUTH_PUBLIC_BASE_URL.replace(/\/$/, "");
}

function authInternalUrl(publicUrl: URL): URL {
  const next = new URL(publicUrl);
  const suffix = next.pathname.slice(AUTH_PUBLIC_PREFIX.length);
  const mappedPath = `${AUTH_INTERNAL_PREFIX}${suffix || ""}`;
  const internal = new URL(mappedPath, getInternalAuthBaseUrl());
  internal.search = next.search;
  return internal;
}

function selectedProxyHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const key of [
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "origin",
    "referer",
    "user-agent",
    "x-rezics-client-class",
    "x-rezics-internal",
  ]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

function getSetCookieValues(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values = withGetSetCookie.getSetCookie?.();
  if (values?.length) return values;
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function rewriteSetCookie(cookie: string): string {
  return cookie.replace(/;\s*Path=\/api\/auth(?=;|$)/i, "; Path=/auth");
}

function rewriteLocation(location: string | null): string | null {
  if (!location) return null;

  const internalBase = getInternalAuthBaseUrl().replace(/\/$/, "");
  const publicBase = getPublicAuthBaseUrl();

  if (location.startsWith(`${internalBase}${AUTH_INTERNAL_PREFIX}`)) {
    return `${publicBase}${location.slice(
      `${internalBase}${AUTH_INTERNAL_PREFIX}`.length,
    )}`;
  }

  if (location.startsWith(AUTH_INTERNAL_PREFIX)) {
    return `${AUTH_PUBLIC_PREFIX}${location.slice(AUTH_INTERNAL_PREFIX.length)}`;
  }

  return location;
}

function rewriteProxyResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of getSetCookieValues(response.headers)) {
    headers.append("set-cookie", rewriteSetCookie(cookie));
  }

  const location = rewriteLocation(headers.get("location"));
  if (location) headers.set("location", location);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function csrfRejected(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const acceptedOrigins = new Set([
    new URL(env.AUTH_PUBLIC_ISSUER_URL).origin,
    new URL(getPublicAuthBaseUrl()).origin,
  ]);

  try {
    return !acceptedOrigins.has(new URL(origin).origin);
  } catch {
    return true;
  }
}

function buildSessionCookie(token: string | null): string {
  const secure =
    env.NODE_ENV === "production" ||
    env.AUTH_PUBLIC_ISSUER_URL.startsWith("https://");
  const maxAge = token ? Number(env.MAIN_SESSION_JWT_TTL_SECONDS ?? "900") : 0;
  const parts = [
    `${SESSION_COOKIE_NAME}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

async function proxyAuthRequest(request: Request): Promise<Response> {
  const publicUrl = new URL(request.url);
  const internalUrl = authInternalUrl(publicUrl);
  const headers = selectedProxyHeaders(request);

  const response = await fetch(internalUrl, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  });

  return rewriteProxyResponse(response);
}

async function fetchAuthSessionState(request: Request) {
  const url = new URL(
    `${AUTH_INTERNAL_PREFIX}/get-session-state`,
    getInternalAuthBaseUrl(),
  );
  const response = await fetch(url, {
    method: "GET",
    headers: selectedProxyHeaders(request),
    redirect: "manual",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AuthSessionStateResponse;
}

export const authPublicApi = new Elysia()
  .post("/auth/session/refresh", async ({ request, set }) => {
    if (csrfRejected(request)) {
      return status(403, {
        error: {
          code: "CSRF_REJECTED",
          message: "Origin is not allowed for session refresh",
        },
      });
    }

    const sessionState = await fetchAuthSessionState(request);
    const userId = sessionState?.user?.id;
    if (!userId) {
      return status(401, {
        error: {
          code: "AUTH_SESSION_INVALID",
          message: "Auth session is invalid or expired",
        },
      });
    }

    const registrationComplete =
      sessionState.authSession?.registrationComplete ??
      Boolean(
        sessionState.authSession?.identitySet &&
          sessionState.user?.emailVerified,
      );
    if (!registrationComplete) {
      return status(403, {
        error: {
          code: "MAIN_USER_NOT_READY",
          message: "Main user is not ready for a member session",
        },
      });
    }

    let user = await prisma.user.findUnique({
      where: { unitId: userId },
      select: { unitId: true, slug: true, permission: true },
    });

    if (!user) {
      const provisioned = await userService.provisionFromJwt({
        unitId: userId,
        slug: userId,
        name: sessionState.user?.name,
      });
      user = {
        unitId: provisioned.unitId,
        slug: provisioned.slug,
        permission: provisioned.permission,
      };
    }

    const dbPermission = user.permission as
      | { role?: string[] }
      | null
      | undefined;
    const role = dbPermission?.role?.[0] ?? "MEMBER";
    const token = await signRezicsSessionToken({
      userId: user.unitId,
      permission: { role },
    });

    set.headers["set-cookie"] = buildSessionCookie(token);
    return {
      authenticated: true,
      userId: user.unitId,
      role,
    };
  })
  .all("/auth/token", () => status(404, "Not Found"))
  .all("/auth/sign-out", async ({ request }) => {
    if (csrfRejected(request)) {
      return status(403, {
        error: {
          code: "CSRF_REJECTED",
          message: "Origin is not allowed for sign-out",
        },
      });
    }

    const response = await proxyAuthRequest(request);
    const headers = new Headers(response.headers);
    headers.append("set-cookie", buildSessionCookie(null));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  })
  .all("/auth/*", async ({ request }) => {
    if (csrfRejected(request)) {
      return status(403, {
        error: {
          code: "CSRF_REJECTED",
          message: "Origin is not allowed for this auth route",
        },
      });
    }

    return proxyAuthRequest(request);
  });
