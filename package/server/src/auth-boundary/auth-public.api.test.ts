import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const fetchMock = mock(async () => Response.json({ ok: true }));
const signRezicsSessionToken = mock(async () => "signed-main-session");
const provisionFromJwt = mock(async () => ({
  unitId: "user-1",
  slug: "reader",
  permission: { role: ["MEMBER"] },
}));
const userFindUnique = mock(async () => ({
  unitId: "user-1",
  slug: "reader",
  permission: { role: ["MEMBER"] },
}));

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
    MAIN_SESSION_JWT_TTL_SECONDS: "900",
  },
}));

mock.module("@/session/jwt/jwt.service", () => ({
  signRezicsSessionToken,
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    provisionFromJwt,
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

  provisionFromJwt.mockReset();
  provisionFromJwt.mockResolvedValue({
    unitId: "user-1",
    slug: "reader",
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

  test("refresh validates auth session internally and sets main session cookie", async () => {
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          emailVerified: true,
        },
        authSession: {
          identitySet: true,
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
      where: { unitId: "user-1" },
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
          emailVerified: false,
        },
        authSession: {
          identitySet: true,
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
