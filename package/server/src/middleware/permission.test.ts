import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const verifyRezicsSessionToken = mock(async (): Promise<any> => ({
  tokenType: "member-session",
  userId: "user-1",
  permission: { role: "MEMBER" },
}));
const verifyRezicsProfileSetupToken = mock(async (): Promise<any> => ({
  tokenType: "profile-setup",
  purpose: "profile-setup",
  userId: "user-1",
}));
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
});
