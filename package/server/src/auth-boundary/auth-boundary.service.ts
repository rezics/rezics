import {
  type AccountSetupBody,
  type SlugAvailabilityResponse,
  validateSlug,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { env } from "@/env";
import {
  signRezicsProfileSetupToken,
  signRezicsSessionToken,
  verifyRezicsProfileSetupToken,
} from "@/session/jwt/jwt.service";
import { mapUserToDTO } from "@/user/models/mapper";
import { userService } from "@/user/service/user.service";
import {
  fetchVerifiedRegistrationFacts,
  projectSlugToAuth,
} from "./auth-internal.client";

const AUTH_PUBLIC_PREFIX = "/auth";
const AUTH_INTERNAL_PREFIX = "/api/auth";
const SESSION_COOKIE_NAME = "rezics-session-token";
const PROFILE_SETUP_COOKIE_NAME = "rezics-profile-setup-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const LOCAL_DEV_ORIGINS = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

type AuthSessionStateResponse = {
  session?: {
    id?: string;
    token?: string;
    userId?: string;
  };
  user?: {
    id?: string;
    name?: string;
    email?: string;
    emailVerified?: boolean;
    image?: string | null;
  };
  authSession?: {
    email?: string;
    mainUserExists?: boolean;
    registrationComplete?: boolean;
    readinessStatus?: string;
    trustedProviderId?: string;
  };
};

function getInternalAuthBaseUrl(): string {
  return env.AUTH_INTERNAL_BASE_URL;
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

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
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
  if (env.NODE_ENV !== "production") {
    for (const localOrigin of LOCAL_DEV_ORIGINS) {
      acceptedOrigins.add(new URL(localOrigin).origin);
    }
  }

  try {
    return !acceptedOrigins.has(new URL(origin).origin);
  } catch {
    return true;
  }
}

function buildMainCookie(
  name: typeof SESSION_COOKIE_NAME | typeof PROFILE_SETUP_COOKIE_NAME,
  token: string | null,
  maxAgeSeconds: number,
): string {
  const secure =
    env.NODE_ENV === "production" ||
    env.AUTH_PUBLIC_ISSUER_URL.startsWith("https://");
  const parts = [
    `${name}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? maxAgeSeconds : 0}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function buildSessionCookie(token: string | null): string {
  return buildMainCookie(
    SESSION_COOKIE_NAME,
    token,
    Number(env.MAIN_SESSION_JWT_TTL_SECONDS ?? "900"),
  );
}

function buildProfileSetupCookie(token: string | null): string {
  return buildMainCookie(PROFILE_SETUP_COOKIE_NAME, token, 900);
}

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Headers,
): Response {
  return Response.json(body, {
    status,
    headers,
  });
}

function csrfError(message: string): Response {
  return jsonResponse(
    {
      error: {
        code: "CSRF_REJECTED",
        message,
      },
    },
    403,
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function findMainUserForAuthUser(authUserId: string) {
  return prisma.user.findUnique({
    where: { authUserId },
    select: { userId: true, slug: true, permission: true },
  });
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

export async function proxyAuthBoundaryRequest(
  request: Request,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for this auth route");
  }

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

export async function checkAccountSlugAvailability(
  slug: string,
): Promise<SlugAvailabilityResponse> {
  const validation = validateSlug(slug);
  if (!validation.ok) {
    return {
      available: false,
      reason: validation.reason,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { slug: validation.normalized },
    select: { userId: true },
  });

  return {
    available: !existing,
    normalized: validation.normalized,
    reason: existing ? "taken" : undefined,
  };
}

export async function materializeMainAccountFromAuth(
  request: Request,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for account materialization");
  }

  const sessionState = await fetchAuthSessionState(request);
  const authUserId = sessionState?.user?.id;
  if (!authUserId) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "AUTH_SESSION_REQUIRED",
          message: "Auth session is invalid or expired",
        },
      },
      401,
    );
  }

  if (!sessionState.user?.emailVerified) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "EMAIL_UNVERIFIED",
          message: "Email verification is required before account setup",
        },
      },
      403,
    );
  }

  const existing = await findMainUserForAuthUser(authUserId);
  if (existing?.slug != null) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "MAIN_USER_EXISTS",
          message: "Main account has already been created",
        },
      },
      409,
    );
  }

  const facts = await fetchVerifiedRegistrationFacts(authUserId);
  if (!facts) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "EMAIL_UNVERIFIED",
          message: "Verified registration facts are not available",
        },
      },
      403,
    );
  }

  const user =
    existing ??
    (await userService.materializeFromVerifiedAuth({
      authUserId: facts.authUserId,
      email: facts.email,
      verifiedAt: facts.verifiedAt ? new Date(facts.verifiedAt) : new Date(),
      verificationSource:
        facts.verificationSource ?? facts.trustedProviderId ?? "email-otp",
      avatar: sessionState.user.image ?? null,
    }));

  const token = await signRezicsProfileSetupToken({ userId: user.userId });
  const expiresAt = new Date(Date.now() + 900 * 1000);
  const headers = new Headers();
  headers.set("set-cookie", buildProfileSetupCookie(token));

  return jsonResponse(
    {
      success: true,
      tokenState: {
        active: true,
        stage: "profile-required",
        expiresAt: expiresAt.toISOString(),
        userId: user.userId,
      },
    },
    200,
    headers,
  );
}

export async function completeProfileSetupFromMain(
  request: Request,
  body: AccountSetupBody,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for profile setup");
  }

  const setupToken =
    readCookie(
      request.headers.get("cookie") ?? undefined,
      PROFILE_SETUP_COOKIE_NAME,
    ) ?? undefined;
  if (!setupToken) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "PROFILE_SETUP_TOKEN_REQUIRED",
          message: "Profile setup token is required",
        },
      },
      401,
    );
  }

  const claims = await verifyRezicsProfileSetupToken(setupToken);
  if (!claims) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "PROFILE_SETUP_TOKEN_INVALID",
          message: "Profile setup token is invalid or expired",
        },
      },
      401,
    );
  }

  const user = await prisma.user.findUnique({
    where: { userId: claims.userId },
    select: {
      userId: true,
      authUserId: true,
      slug: true,
      permission: true,
    },
  });
  if (!user || user.slug !== null) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "PROFILE_SETUP_NOT_REQUIRED",
          message: "Profile setup is not required for this user",
        },
      },
      409,
    );
  }

  const slugValidation = validateSlug(body.slug);
  if (!slugValidation.ok) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "SLUG_INVALID",
          message: slugValidation.reason,
        },
      },
      400,
    );
  }

  try {
    const activated = await userService.completeProfileSetup({
      userId: user.userId,
      slug: slugValidation.normalized,
      displayName: body.displayName,
      avatar: body.avatar,
    });

    if (user.authUserId) {
      void projectSlugToAuth({
        authUserId: user.authUserId,
        slug: slugValidation.normalized,
      });
    }

    const dbPermission = activated.permission as
      | { role?: string[] }
      | null
      | undefined;
    const role = dbPermission?.role?.[0] ?? "MEMBER";
    const token = await signRezicsSessionToken({
      userId: activated.userId,
      permission: { role },
    });

    const headers = new Headers();
    headers.append("set-cookie", buildProfileSetupCookie(null));
    headers.append("set-cookie", buildSessionCookie(token));
    return jsonResponse(
      {
        success: true,
        user: mapUserToDTO(activated),
      },
      200,
      headers,
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "SLUG_TAKEN",
            message: "This slug is already taken",
          },
        },
        409,
      );
    }

    throw error;
  }
}

export async function getMainAwareAuthSessionState(
  request: Request,
): Promise<Response> {
  const sessionState = await fetchAuthSessionState(request);
  const authUserId = sessionState?.user?.id;
  if (!authUserId || !sessionState?.authSession) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_SESSION_INVALID",
          message: "Auth session is invalid or expired",
        },
      },
      401,
    );
  }

  const mainUser = await findMainUserForAuthUser(authUserId);
  const emailVerified = Boolean(sessionState.user?.emailVerified);
  const mainUserExists = Boolean(mainUser);
  const memberReady = mainUser?.slug != null;
  const registrationComplete = emailVerified && memberReady;
  const readinessStatus = !emailVerified
    ? "pending-verification"
    : memberReady
      ? "member-ready"
      : "needs-main-setup";

  return jsonResponse(
    {
      ...sessionState,
      authSession: {
        ...sessionState.authSession,
        emailVerified,
        mainUserExists,
        registrationComplete,
        canAcquireMemberToken: registrationComplete,
        readinessStatus,
        pendingRegistration: {
          active: !registrationComplete,
          step: !emailVerified
            ? "verify-email"
            : memberReady
              ? undefined
              : "setup-account",
          email: sessionState.authSession.email ?? sessionState.user?.email,
          emailVerified,
          requiresEmailVerification: !emailVerified,
          requiresMainAccountSetup: emailVerified && !memberReady,
        },
      },
    },
    200,
  );
}

export async function refreshMainSessionFromAuth(
  request: Request,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for session refresh");
  }

  const sessionState = await fetchAuthSessionState(request);
  const userId = sessionState?.user?.id;
  if (!userId) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_SESSION_INVALID",
          message: "Auth session is invalid or expired",
        },
      },
      401,
    );
  }

  if (!sessionState.user?.emailVerified) {
    return jsonResponse(
      {
        error: {
          code: "MAIN_USER_NOT_READY",
          message:
            "Email verification is required before member session refresh",
        },
      },
      403,
    );
  }

  const user = await findMainUserForAuthUser(userId);
  if (!user) {
    return jsonResponse(
      {
        error: {
          code: "REGISTRATION_INCOMPLETE",
          message:
            "Main account setup is required before member session refresh",
        },
      },
      403,
    );
  }

  if (user.slug === null) {
    return jsonResponse(
      {
        error: {
          code: "PROFILE_SETUP_REQUIRED",
          message: "Profile setup is required before member session refresh",
        },
      },
      403,
    );
  }

  const dbPermission = user.permission as
    | { role?: string[] }
    | null
    | undefined;
  const role = dbPermission?.role?.[0] ?? "MEMBER";
  const token = await signRezicsSessionToken({
    userId: user.userId,
    permission: { role },
  });

  const headers = new Headers();
  headers.set("set-cookie", buildSessionCookie(token));
  return jsonResponse(
    {
      authenticated: true,
      userId: user.userId,
      role,
    },
    200,
    headers,
  );
}

export async function renewProfileSetupSessionFromAuth(
  request: Request,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for profile setup renewal");
  }

  const sessionState = await fetchAuthSessionState(request);
  const userId = sessionState?.user?.id;
  if (!userId) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "AUTH_SESSION_REQUIRED",
          message: "Auth session is invalid or expired",
        },
      },
      401,
    );
  }

  const user = await findMainUserForAuthUser(userId);
  if (!user) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "MAIN_USER_NOT_FOUND",
          message: "Main user has not been materialized",
        },
      },
      404,
    );
  }

  if (user.slug !== null) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "PROFILE_SETUP_NOT_REQUIRED",
          message: "Profile setup is not required for this user",
        },
      },
      409,
    );
  }

  const token = await signRezicsProfileSetupToken({ userId: user.userId });
  const expiresAt = new Date(Date.now() + 900 * 1000);
  const headers = new Headers();
  headers.set("set-cookie", buildProfileSetupCookie(token));

  return jsonResponse(
    {
      success: true,
      tokenState: {
        active: true,
        stage: "profile-required",
        expiresAt: expiresAt.toISOString(),
        userId: user.userId,
      },
    },
    200,
    headers,
  );
}

export async function signOutThroughAuthBoundary(
  request: Request,
): Promise<Response> {
  if (csrfRejected(request)) {
    return csrfError("Origin is not allowed for sign-out");
  }

  const response = await proxyAuthBoundaryRequest(request);
  const headers = new Headers(response.headers);
  headers.append("set-cookie", buildSessionCookie(null));
  headers.append("set-cookie", buildProfileSetupCookie(null));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
