import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json({ ok: true }),
);
const getMainSessionPublicJwks = mock(async () => ({ keys: [] }));
const signRezicsSessionToken = mock(async () => "signed-main-session");
const signRezicsProfileSetupToken = mock(
  async () => "signed-profile-setup-session",
);
const verifyRezicsSessionToken = mock(async () => null);
const verifyRezicsProfileSetupToken = mock(async () => ({
  userId: "user-1",
  tokenType: "profile-setup",
  purpose: "profile-setup",
}));

type MainUserLookup = {
  userId: string;
  slug: string | null;
  authUserId?: string | null;
  permission: { role: string[] };
};

const materializeFromVerifiedAuth = mock(async (_input?: unknown) => ({
  userId: "user-1",
  slug: null,
  name: null,
  email: "reader@example.com",
  permission: { role: ["MEMBER"] },
}));
const completeProfileSetup = mock(async (_input?: unknown) => ({
  userId: "user-1",
  slug: "reader",
  name: "Reader",
  email: "reader@example.com",
  permission: { role: ["MEMBER"] },
}));
const changeCanonicalSlugAsAdmin = mock(
  async (_userId: string, slug: string) => ({
    user: {
      userId: "user-1",
      slug,
      name: "Reader",
    },
    authProjection: { attempted: true, ok: true },
  }),
);
const userFindUnique = mock(
  async (_args?: unknown): Promise<MainUserLookup | null> => ({
    userId: "user-1",
    slug: "reader",
    permission: { role: ["MEMBER"] },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  user: {
    findUnique: userFindUnique,
  },
});

mock.module("@/env", () => ({
  env: {
    NODE_ENV: "test",
    AUTH_BASE_URL: "http://auth.internal",
    AUTH_INTERNAL_BASE_URL: "http://auth.internal",
    AUTH_PUBLIC_BASE_URL: "http://main.test/auth",
    AUTH_PUBLIC_ISSUER_URL: "http://main.test",
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: "internal-test-secret",
    MAIN_SESSION_JWT_TTL_SECONDS: "900",
  },
}));

mock.module("@/session/jwt/jwt.service", () => ({
  getMainSessionPublicJwks,
  signRezicsProfileSetupToken,
  signRezicsSessionToken,
  verifyRezicsProfileSetupToken,
  verifyRezicsSessionToken,
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: { userId: "admin-user", permission: { role: "ADMIN" } },
    }),
  }),
  verifyAdminFromDb: mock(async () => true),
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    changeCanonicalSlugAsAdmin,
    completeProfileSetup,
    materializeFromVerifiedAuth,
  },
}));

function setFetch(
  implementation: Parameters<typeof fetchMock.mockImplementation>[0],
) {
  fetchMock.mockImplementation(implementation);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

beforeEach(() => {
  fetchMock.mockReset();
  setFetch(async () => Response.json({ ok: true }));

  signRezicsSessionToken.mockReset();
  signRezicsSessionToken.mockResolvedValue("signed-main-session");
  signRezicsProfileSetupToken.mockReset();
  signRezicsProfileSetupToken.mockResolvedValue("signed-profile-setup-session");
  getMainSessionPublicJwks.mockReset();
  getMainSessionPublicJwks.mockResolvedValue({ keys: [] });
  verifyRezicsSessionToken.mockReset();
  verifyRezicsSessionToken.mockResolvedValue(null);
  verifyRezicsProfileSetupToken.mockReset();
  verifyRezicsProfileSetupToken.mockResolvedValue({
    userId: "user-1",
    tokenType: "profile-setup",
    purpose: "profile-setup",
  });

  materializeFromVerifiedAuth.mockReset();
  materializeFromVerifiedAuth.mockResolvedValue({
    userId: "user-1",
    slug: null,
    name: null,
    email: "reader@example.com",
    permission: { role: ["MEMBER"] },
  });
  completeProfileSetup.mockReset();
  completeProfileSetup.mockResolvedValue({
    userId: "user-1",
    slug: "reader",
    name: "Reader",
    email: "reader@example.com",
    permission: { role: ["MEMBER"] },
  });
  changeCanonicalSlugAsAdmin.mockReset();
  changeCanonicalSlugAsAdmin.mockResolvedValue({
    user: {
      userId: "user-1",
      slug: "new-reader",
      name: "Reader",
    },
    authProjection: { attempted: true, ok: true },
  });

  userFindUnique.mockReset();
  userFindUnique.mockResolvedValue({
    userId: "user-1",
    slug: "reader",
    permission: { role: ["MEMBER"] },
  });
});

describe("main admin user boundary", () => {
  test("updates canonical user slug and returns auth projection status", async () => {
    const { adminRoute } = await import("@/user/api/user.admin.api");

    const response = await adminRoute.handle(
      new Request("http://localhost/admin/user-1/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: " New-Reader " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(changeCanonicalSlugAsAdmin).toHaveBeenCalledWith(
      "user-1",
      "new-reader",
    );
    expect(await response.json()).toMatchObject({
      user: {
        userId: "user-1",
        slug: "new-reader",
        name: "Reader",
      },
      authProjection: { attempted: true, ok: true },
    });
  });

  test("rejects invalid admin slug changes before updating main", async () => {
    const { adminRoute } = await import("@/user/api/user.admin.api");

    const response = await adminRoute.handle(
      new Request("http://localhost/admin/user-1/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "bad slug" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(changeCanonicalSlugAsAdmin).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      error: { code: "SLUG_INVALID" },
    });
  });

  test("surfaces admin slug projection failure without rolling back main", async () => {
    changeCanonicalSlugAsAdmin.mockResolvedValueOnce({
      user: {
        userId: "user-1",
        slug: "new-reader",
        name: "Reader",
      },
      authProjection: { attempted: true, ok: false },
    });
    const { adminRoute } = await import("@/user/api/user.admin.api");

    const response = await adminRoute.handle(
      new Request("http://localhost/admin/user-1/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "new-reader" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authProjection: { attempted: true, ok: false },
    });
  });

  test("returns conflict when admin slug is already taken", async () => {
    const error = new Error("duplicate") as Error & { code: string };
    error.code = "P2002";
    changeCanonicalSlugAsAdmin.mockRejectedValueOnce(error);
    const { adminRoute } = await import("@/user/api/user.admin.api");

    const response = await adminRoute.handle(
      new Request("http://localhost/admin/user-1/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "new-reader" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "SLUG_TAKEN" },
    });
  });
});

describe("main auth public boundary", () => {
  test("maps public auth paths to internal /api/auth paths and preserves request details", async () => {
    setFetch(async () =>
      Response.json(
        { proxied: true },
        {
          status: 201,
        },
      ),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/sign-in/email?next=%2Fshelves", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session_token=opaque",
          origin: "http://main.test",
          "x-extra-header": "not-forwarded",
        },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ proxied: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "http://auth.internal/api/auth/sign-in/email?next=%2Fshelves",
    );
    expect(init).toMatchObject({
      method: "POST",
      redirect: "manual",
    });
    const headers = init?.headers as Headers;
    expect(headers.get("cookie")).toBe("better-auth.session_token=opaque");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-extra-header")).toBeNull();
    expect(init?.body).toBeInstanceOf(ReadableStream);
  });

  test("allows local frontend dev origins through the auth boundary", async () => {
    setFetch(async () => Response.json({ proxied: true }));

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:35001",
        },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ proxied: true });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://auth.internal/api/auth/sign-in/email",
    );
  });

  test("rewrites proxied cookie paths and redirect locations to public auth paths", async () => {
    setFetch(
      async () =>
        new Response(null, {
          status: 302,
          headers: {
            "set-cookie":
              "better-auth.session_token=opaque; Path=/api/auth; HttpOnly; SameSite=Lax",
            location: "http://auth.internal/api/auth/callback/google?ok=1",
          },
        }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/callback/google?ok=1"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://main.test/auth/callback/google?ok=1",
    );
    expect(response.headers.get("set-cookie")).toContain("Path=/auth");
    expect(response.headers.get("set-cookie")).not.toContain("Path=/api/auth");
  });

  test("blocks public auth session JWT acquisition", async () => {
    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/token"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("passes auth-domain admin and oauth registration routes through without main authorization", async () => {
    setFetch(async () => Response.json({ authOwned: true }));

    const { authPublicApi } = await import("./auth-public.api");
    const adminResponse = await authPublicApi.handle(
      new Request("http://main.test/auth/admin/list-users", {
        headers: {
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );
    const registerResponse = await authPublicApi.handle(
      new Request("http://main.test/auth/oauth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session_token=opaque",
          origin: "http://main.test",
        },
        body: JSON.stringify({ client_name: "Test Client" }),
      }),
    );

    expect(adminResponse.status).toBe(200);
    expect(registerResponse.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://auth.internal/api/auth/admin/list-users",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "http://auth.internal/api/auth/oauth/register",
    );
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("refresh validates auth session internally and sets main session cookie", async () => {
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authSession: {
          registrationComplete: true,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      userId: "user-1",
      role: "MEMBER",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://auth.internal/api/auth/get-session-state",
    );
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { authUserId: "user-1" },
      select: {
        userId: true,
        slug: true,
        permission: true,
      },
    });
    expect(signRezicsSessionToken).toHaveBeenCalledWith({
      userId: "user-1",
      permission: { role: "MEMBER" },
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("rezics-session-token=signed-main-session");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  test("refresh rejects invalid auth session without setting main session cookie", async () => {
    setFetch(async () =>
      Response.json(
        {
          error: "unauthorized",
        },
        {
          status: 401,
        },
      ),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=bad",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("refresh rejects unready main users", async () => {
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: false,
        },
        authSession: {
          registrationComplete: false,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("refresh rejects verified auth sessions before main setup", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authSession: {
          registrationComplete: false,
          readinessStatus: "needs-main-setup",
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "REGISTRATION_INCOMPLETE",
        message: "Main account setup is required before member session refresh",
      },
    });
    expect(materializeFromVerifiedAuth).not.toHaveBeenCalled();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("refresh rejects materialized users whose slug is still null (slug !== null is the readiness gate)", async () => {
    userFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authSession: {
          registrationComplete: false,
          readinessStatus: "needs-main-setup",
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: "PROFILE_SETUP_REQUIRED",
        message: "Profile setup is required before member session refresh",
      },
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("renews profile setup token for materialized setup users", async () => {
    userFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      slug: null,
      permission: { role: ["MEMBER"] },
    });
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          email: "reader@example.com",
          emailVerified: true,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/profile-setup-token/renew", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(signRezicsProfileSetupToken).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect((await response.json()).tokenState).toMatchObject({
      active: true,
      stage: "profile-required",
      userId: "user-1",
    });
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-profile-setup-token=signed-profile-setup-session",
    );
  });

  test("rejects setup token renewal for member-ready users", async () => {
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          email: "reader@example.com",
          emailVerified: true,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/profile-setup-token/renew", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(409);
    expect(signRezicsProfileSetupToken).not.toHaveBeenCalled();
  });

  test("materializes a minimal main account for a verified auth-only session", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    setFetch(async (input) => {
      const url = String(input);
      if (url.endsWith("/internal/registration/verified-facts")) {
        return Response.json({
          success: true,
          facts: {
            authUserId: "user-1",
            email: "reader@example.com",
            emailVerified: true,
            verifiedAt: "2026-05-07T00:00:00.000Z",
            verificationSource: "github",
            trustedProviderId: "github",
          },
        });
      }
      return Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
          image: null,
        },
      });
    });

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/materialize", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    const setupInput = materializeFromVerifiedAuth.mock.calls[0]?.[0] as {
      authUserId: string;
      email: string;
      verifiedAt: Date;
      verificationSource: string;
      avatar: string | null;
    };
    expect(setupInput).toMatchObject({
      authUserId: "user-1",
      email: "reader@example.com",
      verificationSource: "github",
      avatar: null,
    });
    expect(setupInput.verifiedAt).toBeInstanceOf(Date);
    expect((await response.json()).success).toBe(true);
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-profile-setup-token=signed-profile-setup-session",
    );
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("duplicate materialization for setup users reissues setup token", async () => {
    userFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      slug: null,
      permission: { role: ["MEMBER"] },
    });
    setFetch(async (input) => {
      const url = String(input);
      if (url.endsWith("/internal/registration/verified-facts")) {
        return Response.json({
          success: true,
          facts: {
            authUserId: "user-1",
            email: "reader@example.com",
            emailVerified: true,
            verifiedAt: "2026-05-07T00:00:00.000Z",
            verificationSource: "email-otp",
          },
        });
      }
      return Response.json({
        user: {
          id: "user-1",
          email: "reader@example.com",
          emailVerified: true,
          image: null,
        },
      });
    });

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/materialize", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(materializeFromVerifiedAuth).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-profile-setup-token=signed-profile-setup-session",
    );
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("materialization rejects unverified auth sessions", async () => {
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          email: "reader@example.com",
          emailVerified: false,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/materialize", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("EMAIL_UNVERIFIED");
    expect(materializeFromVerifiedAuth).not.toHaveBeenCalled();
  });

  test("profile setup activates a materialized user", async () => {
    userFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/profile-setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://main.test",
          cookie: "rezics-profile-setup-token=setup-token",
        },
        body: JSON.stringify({
          displayName: "Reader",
          slug: "reader",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(completeProfileSetup).toHaveBeenCalledWith({
      userId: "user-1",
      slug: "reader",
      displayName: "Reader",
      avatar: undefined,
    });
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-session-token=signed-main-session",
    );
  });

  test("profile setup returns slug conflict from main uniqueness", async () => {
    userFindUnique.mockResolvedValueOnce({
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    completeProfileSetup.mockRejectedValueOnce({ code: "P2002" });

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/profile-setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://main.test",
          cookie: "rezics-profile-setup-token=setup-token",
        },
        body: JSON.stringify({
          displayName: "Reader",
          slug: "reader",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("SLUG_TAKEN");
  });

  test("checks slug availability against main user slugs", async () => {
    userFindUnique.mockResolvedValueOnce(null);

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request(
        "http://main.test/auth/account/slug-availability?slug=reader",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      available: true,
      normalized: "reader",
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { slug: "reader" },
      select: { userId: true },
    });
  });

  test("refresh rejects disallowed origins", async () => {
    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/session/refresh", {
        method: "POST",
        headers: {
          origin: "http://evil.test",
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sign-out proxies auth invalidation and clears main session cookie", async () => {
    setFetch(async () => Response.json({ success: true }));

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/sign-out", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque; rezics-session-token=old",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "http://auth.internal/api/auth/sign-out",
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("rezics-session-token=");
    expect(cookie).toContain("rezics-profile-setup-token=");
    expect(cookie).toContain("Max-Age=0");
  });
});
