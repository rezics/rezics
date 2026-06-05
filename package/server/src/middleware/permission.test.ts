import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia, status } from "elysia";

const verifyRezicsSessionToken = mock(
  async (): Promise<any> => ({
    tokenType: "member-session",
    userId: "user-1",
    permission: { role: "MEMBER" },
  }),
);
const verifyRezicsProfileSetupToken = mock(
  async (): Promise<any> => ({
    tokenType: "profile-setup",
    purpose: "profile-setup",
    userId: "user-1",
  }),
);
const getMainSessionPublicJwks = mock(async () => ({ keys: [] }));
const signRezicsSessionToken = mock(async () => "signed-session-token");
const signRezicsProfileSetupToken = mock(
  async () => "signed-profile-setup-token",
);

mock.module("@/session/jwt/jwt.service", () => ({
  getMainSessionPublicJwks,
  signRezicsProfileSetupToken,
  signRezicsSessionToken,
  verifyRezicsProfileSetupToken,
  verifyRezicsSessionToken,
}));

mock.module("./permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" })
    .macro("requireLogin", {
      async resolve(ctx) {
        const headers = (ctx as any).headers as Record<
          string,
          string | undefined
        >;
        const token =
          headers.authorization ??
          headers.cookie
            ?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("rezics-session-token="))
            ?.slice("rezics-session-token=".length);
        if (!token) return status(401, "Unauthorized");
        const identity = await verifyRezicsSessionToken(
          decodeURIComponent(token),
        );
        if (!identity) return status(401, "Unauthorized");
        return { identity };
      },
    })
    .macro("requireProfileSetup", {
      async resolve(ctx) {
        const headers = (ctx as any).headers as Record<
          string,
          string | undefined
        >;
        const token = headers.cookie
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("rezics-profile-setup-token="))
          ?.slice("rezics-profile-setup-token=".length);
        if (!token) return status(401, "Unauthorized");
        const setupIdentity = await verifyRezicsProfileSetupToken(
          decodeURIComponent(token),
        );
        if (!setupIdentity) return status(401, "Unauthorized");
        return { setupIdentity };
      },
    }),
  isAdminRole: (identity: any) =>
    identity?.permission?.role === "ADMIN" ||
    identity?.permission?.role === "ROOT",
  tryResolveIdentity: async (authorization?: string, cookieHeader?: string) => {
    const token =
      authorization ??
      cookieHeader
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("rezics-session-token="))
        ?.slice("rezics-session-token=".length);
    return token ? verifyRezicsSessionToken(decodeURIComponent(token)) : null;
  },
  verifyAdminFromDb: async () => false,
  verifyRootFromDb: async () => false,
}));

describe("main auth middleware", () => {
  beforeEach(() => {
    verifyRezicsSessionToken.mockReset();
    verifyRezicsSessionToken.mockResolvedValue({
      tokenType: "member-session",
      userId: "user-1",
      permission: { role: "MEMBER" },
    });
    verifyRezicsProfileSetupToken.mockReset();
    verifyRezicsProfileSetupToken.mockResolvedValue({
      tokenType: "profile-setup",
      purpose: "profile-setup",
      userId: "user-1",
    });
  });

  test("resolves browser rezics-session-token cookies", async () => {
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/member", ({ identity }) => identity, { requireLogin: true });

    const response = await app.handle(
      new Request("http://localhost/member", {
        headers: {
          cookie: "rezics-session-token=cookie-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(verifyRezicsSessionToken).toHaveBeenCalledWith("cookie-token");
    expect(await response.json()).toMatchObject({
      userId: "user-1",
      permission: { role: "MEMBER" },
    });
  });

  test("keeps Authorization precedence for non-browser callers", async () => {
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/member", ({ identity }) => identity, { requireLogin: true });

    await app.handle(
      new Request("http://localhost/member", {
        headers: {
          authorization: "Bearer api-token",
          cookie: "rezics-session-token=cookie-token",
        },
      }),
    );

    expect(verifyRezicsSessionToken).toHaveBeenCalledWith("Bearer api-token");
  });

  test("resolves profile setup cookies only for profile setup routes", async () => {
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/setup", ({ setupIdentity }) => setupIdentity, {
        requireProfileSetup: true,
      });

    const response = await app.handle(
      new Request("http://localhost/setup", {
        headers: {
          cookie: "rezics-profile-setup-token=setup-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(verifyRezicsProfileSetupToken).toHaveBeenCalledWith("setup-token");
    expect(await response.json()).toMatchObject({
      tokenType: "profile-setup",
      purpose: "profile-setup",
      userId: "user-1",
    });
  });

  test("rejects profile setup token on member routes", async () => {
    verifyRezicsSessionToken.mockResolvedValue(null);
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/member", ({ identity }) => identity, { requireLogin: true });

    const response = await app.handle(
      new Request("http://localhost/member", {
        headers: {
          cookie: "rezics-profile-setup-token=setup-token",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyRezicsSessionToken).not.toHaveBeenCalled();
  });

  test("rejects member token on profile setup routes", async () => {
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/setup", ({ setupIdentity }) => setupIdentity, {
        requireProfileSetup: true,
      });

    const response = await app.handle(
      new Request("http://localhost/setup", {
        headers: {
          cookie: "rezics-session-token=member-token",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyRezicsProfileSetupToken).not.toHaveBeenCalled();
  });

  test("rejects invalid profile setup tokens", async () => {
    verifyRezicsProfileSetupToken.mockResolvedValue(null);
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/setup", ({ setupIdentity }) => setupIdentity, {
        requireProfileSetup: true,
      });

    const response = await app.handle(
      new Request("http://localhost/setup", {
        headers: {
          cookie: "rezics-profile-setup-token=invalid",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  test("rejects expired profile setup tokens", async () => {
    verifyRezicsProfileSetupToken.mockResolvedValue(null);
    const { authMacro } = await import("./permission");
    const app = new Elysia()
      .use(authMacro)
      .get("/setup", ({ setupIdentity }) => setupIdentity, {
        requireProfileSetup: true,
      });

    const response = await app.handle(
      new Request("http://localhost/setup", {
        headers: {
          cookie: "rezics-profile-setup-token=expired",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyRezicsProfileSetupToken).toHaveBeenCalledWith("expired");
  });
});
