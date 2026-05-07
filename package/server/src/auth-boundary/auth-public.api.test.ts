import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json({ ok: true }),
);
const getMainSessionPublicJwks = mock(async () => ({ keys: [] }));
const signRezicsSessionToken = mock(async () => "signed-main-session");
const verifyRezicsSessionToken = mock(async () => null);

type MainUserLookup = {
  unitId: string;
  slug: string;
  permission: { role: string[] };
};

const createFromVerifiedAuth = mock(async (_input?: unknown) => ({
  unitId: "user-1",
  slug: "reader",
  name: "Reader",
  email: "reader@example.com",
  permission: { role: ["MEMBER"] },
}));
const userFindUnique = mock(
  async (_args?: unknown): Promise<MainUserLookup | null> => ({
    unitId: "user-1",
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
  signRezicsSessionToken,
  verifyRezicsSessionToken,
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    createFromVerifiedAuth,
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
  getMainSessionPublicJwks.mockReset();
  getMainSessionPublicJwks.mockResolvedValue({ keys: [] });
  verifyRezicsSessionToken.mockReset();
  verifyRezicsSessionToken.mockResolvedValue(null);

  createFromVerifiedAuth.mockReset();
  createFromVerifiedAuth.mockResolvedValue({
    unitId: "user-1",
    slug: "reader",
    name: "Reader",
    email: "reader@example.com",
    permission: { role: ["MEMBER"] },
  });

  userFindUnique.mockReset();
  userFindUnique.mockResolvedValue({
    unitId: "user-1",
    slug: "reader",
    permission: { role: ["MEMBER"] },
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
      select: { unitId: true, slug: true, permission: true },
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
    expect(createFromVerifiedAuth).not.toHaveBeenCalled();
    expect(signRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("sets up a main account for a verified auth-only session", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
          image: null,
        },
        authSession: {
          trustedProviderId: "github",
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/account/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
        body: JSON.stringify({
          displayName: "Reader",
          slug: "reader",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const setupInput = createFromVerifiedAuth.mock.calls[0]?.[0] as {
      authUserId: string;
      email: string;
      displayName: string;
      slug: string;
      emailVerifiedAt: Date;
      emailVerificationSource: string;
      avatar: string | null;
    };
    expect(setupInput).toMatchObject({
      authUserId: "user-1",
      email: "reader@example.com",
      displayName: "Reader",
      slug: "reader",
      emailVerificationSource: "github",
      avatar: null,
    });
    expect(setupInput.emailVerifiedAt).toBeInstanceOf(Date);
    expect((await response.json()).success).toBe(true);
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-session-token=signed-main-session",
    );
  });

  test("setup rejects unverified auth sessions", async () => {
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
      new Request("http://main.test/auth/account/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
        },
        body: JSON.stringify({
          displayName: "Reader",
          slug: "reader",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("EMAIL_UNVERIFIED");
    expect(createFromVerifiedAuth).not.toHaveBeenCalled();
  });

  test("setup returns slug conflict from main uniqueness", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    createFromVerifiedAuth.mockRejectedValueOnce({ code: "P2002" });
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
      new Request("http://main.test/auth/account/setup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque",
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
      select: { unitId: true },
    });
  });

  test("cancel registration calls auth internal cleanup and clears browser cookies", async () => {
    userFindUnique.mockResolvedValueOnce(null);
    setFetch(async (url) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/api/auth/get-session-state") {
        return Response.json({
          user: {
            id: "user-1",
            email: "reader@example.com",
            emailVerified: true,
          },
        });
      }
      return Response.json({ success: true, canceled: true });
    });

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/registration/cancel", {
        method: "POST",
        headers: {
          origin: "http://main.test",
          cookie: "better-auth.session_token=opaque; rezics-session-token=old",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      canceled: true,
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "http://auth.internal/internal/registration/cancel",
    );
    expect(
      (fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>)[
        "x-internal-secret"
      ],
    ).toBe("internal-test-secret");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("rezics-session-token=");
    expect(cookie).toContain("rezics_logged_in=");
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
    expect(cookie).toContain("Max-Age=0");
  });
});
