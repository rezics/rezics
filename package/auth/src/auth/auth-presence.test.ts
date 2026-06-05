import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.SMTP_HOST ??= "smtp.test";
process.env.SMTP_USER ??= "smtp-user";
process.env.SMTP_PASSWORD ??= "smtp-password";
process.env.TURNSTILE_SECRET ??= "turnstile-secret";

import { AUTH_PRESENCE_COOKIE_NAME } from "@rezics/contract";

const authHandlerMock = mock();

mock.module("@better-auth/oauth-provider", () => ({
  oauthProviderOpenIdConfigMetadata: () => () =>
    Response.json({ issuer: "test" }),
  oauthProviderAuthServerMetadata: () => () =>
    Response.json({ issuer: "test" }),
}));

mock.module("./instance", () => ({
  auth: {
    handler: authHandlerMock,
  },
}));

describe("auth presence cookies", () => {
  beforeEach(() => {
    authHandlerMock.mockReset();
  });

  test("sets the auth presence cookie on successful token bootstrap", async () => {
    authHandlerMock.mockResolvedValueOnce(
      Response.json({ token: "jwt-token" }, { status: 200 }),
    );

    const { handleAuthRequest } = await import("./routes");
    const response = await handleAuthRequest(
      new Request("http://localhost:35003/token"),
    );

    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_PRESENCE_COOKIE_NAME}=1`,
    );
  });

  test("sets the auth presence cookie on successful sign-up", async () => {
    authHandlerMock.mockResolvedValueOnce(
      Response.json({ user: { id: "user-1" } }, { status: 200 }),
    );

    const { handleAuthRequest } = await import("./routes");
    const response = await handleAuthRequest(
      new Request("http://localhost:35003/api/auth/sign-up/email", {
        method: "POST",
      }),
    );

    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_PRESENCE_COOKIE_NAME}=1`,
    );
  });

  test("clears the auth presence cookie on sign-out", async () => {
    authHandlerMock.mockResolvedValueOnce(
      Response.json({ success: true }, { status: 200 }),
    );

    const { handleAuthRequest } = await import("./routes");
    const response = await handleAuthRequest(
      new Request("http://localhost:35003/api/auth/sign-out", {
        method: "POST",
      }),
    );

    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  test("clears the auth presence cookie when session checks fail", async () => {
    authHandlerMock.mockResolvedValueOnce(
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    );

    const { handleAuthRequest } = await import("./routes");
    const response = await handleAuthRequest(
      new Request("http://localhost:35003/token"),
    );

    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
