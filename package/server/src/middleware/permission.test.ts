import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const verifyRezicsSessionToken = mock(async () => ({
  userId: "user-1",
  permission: { role: "MEMBER" },
}));
const getMainSessionPublicJwks = mock(async () => ({ keys: [] }));
const signRezicsSessionToken = mock(async () => "signed-session-token");

mock.module("@/session/jwt/jwt.service", () => ({
  getMainSessionPublicJwks,
  signRezicsSessionToken,
  verifyRezicsSessionToken,
}));

describe("main auth middleware", () => {
  beforeEach(() => {
    verifyRezicsSessionToken.mockReset();
    verifyRezicsSessionToken.mockResolvedValue({
      userId: "user-1",
      permission: { role: "MEMBER" },
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
});
