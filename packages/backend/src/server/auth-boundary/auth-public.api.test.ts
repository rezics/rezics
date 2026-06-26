import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_INTERNAL_BASE_URL ??= "http://auth.internal";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://main.test/auth";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://main.test";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "smtp";
process.env.SMTP_PASSWORD ??= "smtp";
process.env.TURNSTILE_SECRET ??= "turnstile";
process.env.MEILI_HOST ??= "http://localhost:7700";
process.env.MEILI_MASTER_KEY ??= "masterKey";
process.env.NOTIFY_BASE_URL ??= "http://localhost:3010";
process.env.NOTIFY_INTERNAL_SECRET ??= "notify";
process.env.REACTION_BASE_URL ??= "http://localhost:3011";
process.env.REACTION_INTERNAL_SECRET ??= "reaction";

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
  unitId: string;
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
const userSelectRow = mock(
  async (): Promise<MainUserLookup | null> => ({
    unitId: "user-1",
    userId: "user-1",
    slug: "reader",
    permission: { role: ["MEMBER"] },
  }),
);
const unitSelectRow = mock(
  async (): Promise<{
    id?: string;
    slug: string | null;
    type: string;
  } | null> => ({
    id: "user-1",
    slug: "reader",
    type: "USER",
  }),
);
const projectedPermissionForUser = mock(
  async (_userId: string, storedPermission: unknown) => {
    const roleValue =
      storedPermission &&
      typeof storedPermission === "object" &&
      "role" in storedPermission
        ? (storedPermission as { role?: unknown }).role
        : undefined;
    const role = Array.isArray(roleValue) ? roleValue[0] : roleValue;
    return { role: role === "BLOCKED" ? "MEMBER" : (role ?? "MEMBER") };
  },
);

function createSelectBuilder(selection: Record<string, unknown> | undefined) {
  const builder = {
    from: mock((_table: unknown) => {
      return builder;
    }),
    innerJoin: mock(() => builder),
    where: mock(() => builder),
    limit: mock(async () => {
      if (selection && "unitId" in selection) {
        const row = await userSelectRow();
        return row ? [row] : [];
      }
      if (selection && "id" in selection && "type" in selection) {
        const row = await unitSelectRow();
        return row ? [{ id: row.id ?? "user-1", type: row.type }] : [];
      }
      return [];
    }),
  };
  return builder;
}

mock.module("../db/client", () => ({
  db: {
    select: mock((selection?: Record<string, unknown>) =>
      createSelectBuilder(selection),
    ),
  },
}));

mock.module("@/governance/enforcement.service", () => ({
  governanceEnforcementService: {
    projectedPermissionForUser,
  },
}));

mock.module("../governance/enforcement.service", () => ({
  governanceEnforcementService: {
    projectedPermissionForUser,
  },
}));

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

mock.module("../env", () => ({
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

mock.module("../session/jwt/jwt.service", () => ({
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
    completeProfileSetup,
    materializeFromVerifiedAuth,
  },
}));

mock.module("@/user/service/settings.service", () => ({
  normalizePreferredLanguages: (input?: readonly string[] | null) => {
    const languages = [...new Set(input ?? [])].filter(Boolean);
    return languages.length > 0 ? languages : ["en"];
  },
}));

mock.module("@/user/models/mapper", () => ({
  mapUserToDTO: mock((user: unknown) => user),
}));

mock.module("../user/service/user.service", () => ({
  userService: {
    completeProfileSetup,
    materializeFromVerifiedAuth,
  },
}));

mock.module("../user/models/mapper", () => ({
  mapUserToDTO: mock((user: unknown) => user),
}));

mock.module("@/unit/collaborative-metadata", () => ({
  assertEditorialPatchAllowed: mock(() => undefined),
}));

mock.module("@/infra/slug-scopes", () => ({
  requireSlugScopeId: mock(() => "user"),
}));

mock.module("../infra/slug-scopes", () => ({
  requireSlugScopeId: mock(() => "user"),
}));

mock.module("@/notify-boundary/notify-boundary.client", () => ({
  broadcast: mock(async () => undefined),
  filterRecipientsByPreference: mock(async (recipients: unknown) => recipients),
  resolveRecipients: mock(
    async (event: { directRecipients?: string[] }) =>
      event.directRecipients ?? [],
  ),
  sendDm: mock(async () => ({ ok: true })),
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
  projectedPermissionForUser.mockReset();
  projectedPermissionForUser.mockImplementation(
    async (_userId: string, storedPermission: unknown) => {
      const roleValue =
        storedPermission &&
        typeof storedPermission === "object" &&
        "role" in storedPermission
          ? (storedPermission as { role?: unknown }).role
          : undefined;
      const role = Array.isArray(roleValue) ? roleValue[0] : roleValue;
      return { role: role === "BLOCKED" ? "MEMBER" : (role ?? "MEMBER") };
    },
  );

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
  userSelectRow.mockReset();
  userSelectRow.mockResolvedValue({
    unitId: "user-1",
    userId: "user-1",
    slug: "reader",
    permission: { role: ["MEMBER"] },
  });
  unitSelectRow.mockReset();
  unitSelectRow.mockResolvedValue({ slug: "reader", type: "USER" });
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
    expect(userSelectRow).not.toHaveBeenCalled();
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
        authAccountState: {
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
    expect(userSelectRow).toHaveBeenCalled();
    expect(signRezicsSessionToken).toHaveBeenCalledWith({
      userId: "user-1",
      permission: { role: "MEMBER" },
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("rezics-session-token=signed-main-session");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  test("refresh projects BLOCKED only from active enforcement", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: "reader",
      permission: { role: ["MEMBER"] },
    });
    projectedPermissionForUser.mockResolvedValueOnce({ role: "BLOCKED" });
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
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
    expect(await response.json()).toMatchObject({
      authenticated: true,
      role: "BLOCKED",
    });
    expect(projectedPermissionForUser).toHaveBeenCalledWith("user-1", {
      role: ["MEMBER"],
    });
    expect(signRezicsSessionToken).toHaveBeenCalledWith({
      userId: "user-1",
      permission: { role: "BLOCKED" },
    });
  });

  test("refresh downgrades stale stored BLOCKED when enforcement is inactive", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: "reader",
      permission: { role: ["BLOCKED"] },
    });
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
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
    expect(await response.json()).toMatchObject({
      authenticated: true,
      role: "MEMBER",
    });
    expect(signRezicsSessionToken).toHaveBeenCalledWith({
      userId: "user-1",
      permission: { role: "MEMBER" },
    });
  });

  test("session state keeps auth role separate from Rezics permission", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "main-root-user",
      userId: "main-root-user",
      slug: "root",
      authUserId: "auth-owner-user",
      permission: { role: ["ROOT"] },
    });
    setFetch(async () =>
      Response.json({
        session: {
          id: "session-1",
          token: "opaque",
          expiresAt: "2026-03-10T00:00:00.000Z",
          userId: "auth-owner-user",
        },
        user: {
          id: "auth-owner-user",
          name: "Root",
          role: "owner",
          email: "root@example.com",
          emailVerified: true,
          createdAt: "2026-03-10T00:00:00.000Z",
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
        authAccountState: {
          email: "root@example.com",
          emailVerified: true,
          mainUserExists: true,
          registrationComplete: true,
          canAcquireMemberToken: true,
          readinessStatus: "member-ready",
          pendingRegistration: {
            active: false,
            email: "root@example.com",
            emailVerified: true,
            requiresEmailVerification: false,
            requiresMainAccountSetup: false,
          },
          hasPassword: true,
          canSetPassword: false,
          providerIds: [],
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/get-session-state", {
        headers: {
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: {
        id: "auth-owner-user",
        role: "owner",
      },
      rezicsUserId: "main-root-user",
      rezicsPermission: { role: "ROOT" },
    });
  });

  test("session state uses derived permission projection", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "main-user",
      userId: "main-user",
      slug: "reader",
      authUserId: "auth-user",
      permission: { role: ["MEMBER"] },
    });
    projectedPermissionForUser.mockResolvedValueOnce({ role: "BLOCKED" });
    setFetch(async () =>
      Response.json({
        session: {
          id: "session-1",
          token: "opaque",
          userId: "auth-user",
        },
        user: {
          id: "auth-user",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
          email: "reader@example.com",
          registrationComplete: true,
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/get-session-state", {
        headers: {
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      rezicsUserId: "main-user",
      rezicsPermission: { role: "BLOCKED" },
    });
    expect(projectedPermissionForUser).toHaveBeenCalledWith("main-user", {
      role: ["MEMBER"],
    });
  });

  test("session state reports auth-main reconciliation diagnostics", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "main-user",
      userId: "main-user",
      slug: "reader",
      authUserId: "auth-user",
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: "reader", type: "USER" });
    setFetch(async () =>
      Response.json({
        session: {
          id: "session-1",
          token: "opaque",
          userId: "auth-user",
        },
        user: {
          id: "auth-user",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
          email: "reader@example.com",
          mainUserExists: false,
          registrationComplete: false,
          readinessStatus: "needs-main-setup",
        },
      }),
    );

    const { authPublicApi } = await import("./auth-public.api");
    const response = await authPublicApi.handle(
      new Request("http://main.test/auth/get-session-state", {
        headers: {
          cookie: "better-auth.session_token=opaque",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authBoundaryDiagnostics: {
        reconciliation: [
          {
            code: "AUTH_MAIN_USER_EXISTS_MISMATCH",
            severity: "warning",
            authValue: false,
            mainValue: true,
          },
          {
            code: "AUTH_MAIN_REGISTRATION_COMPLETE_MISMATCH",
            severity: "warning",
            authValue: false,
            mainValue: true,
          },
          {
            code: "AUTH_MAIN_READINESS_STATUS_MISMATCH",
            severity: "warning",
            authValue: "needs-main-setup",
            mainValue: "member-ready",
          },
        ],
      },
    });
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
        authAccountState: {
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
    userSelectRow.mockResolvedValueOnce(null);
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
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
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });
    setFetch(async () =>
      Response.json({
        user: {
          id: "user-1",
          name: "Reader",
          email: "reader@example.com",
          emailVerified: true,
        },
        authAccountState: {
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
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });
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
    userSelectRow.mockResolvedValueOnce(null);
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
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });
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
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });

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
      preferredLanguages: ["en"],
    });
    expect(response.headers.get("set-cookie")).toContain(
      "rezics-session-token=signed-main-session",
    );
  });

  test("profile setup passes submitted preferred languages", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });

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
          preferredLanguages: ["ja", "en"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(completeProfileSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLanguages: ["ja", "en"],
      }),
    );
  });

  test("profile setup returns slug conflict from main uniqueness", async () => {
    userSelectRow.mockResolvedValueOnce({
      unitId: "user-1",
      userId: "user-1",
      slug: null,
      authUserId: "user-1",
      permission: { role: ["MEMBER"] },
    });
    unitSelectRow.mockResolvedValueOnce({ slug: null, type: "USER" });
    completeProfileSetup.mockRejectedValueOnce({ code: "23505" });

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
    unitSelectRow.mockResolvedValueOnce(null);

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
    expect(unitSelectRow).toHaveBeenCalled();
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
