import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_auth";
process.env.BETTER_AUTH_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:35003";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:35003";
process.env.BETTER_AUTH_SECRET ??=
  "this-is-a-long-auth-secret-for-tests-123456";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";
process.env.AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";
process.env.AUTH_JWT_AUDIENCE ??= "rezics";
process.env.AUTH_JWT_ISSUER ??= "http://localhost:35003";
process.env.SMTP_HOST ??= "smtp.test";
process.env.SMTP_USER ??= "smtp-user";
process.env.SMTP_PASSWORD ??= "smtp-password";
process.env.TURNSTILE_SECRET ??= "turnstile-secret";

const handleAuthRequest = mock((request: Request) => {
  const url = new URL(request.url);

  return Response.json({
    method: request.method,
    pathname: url.pathname,
    search: url.search,
  });
});
const accountFindMany = mock(async () => [
  { providerId: "credential", password: "hashed-password" },
]);

mock.module("../auth/routes", () => ({
  handleAuthRequest,
  handleJwksWellKnownRequest: () =>
    Response.json({ pathname: "/api/auth/session/jwks" }),
  handleOpenIdConfigRequest: () =>
    Response.json({ issuer: "http://localhost:35003" }),
  handleOAuthAuthorizationServerRequest: () =>
    Response.json({ issuer: "http://localhost:35003" }),
}));

mock.module("../auth/prisma", () => ({
  prisma: {
    account: {
      findMany: accountFindMany,
    },
  },
}));

mock.module("../session/jwt/routes", () => ({
  getAuthSessionJwksResponse: () =>
    Response.json({ pathname: "/api/auth/session/jwks" }),
}));

describe("auth openapi routes", () => {
  beforeEach(() => {
    handleAuthRequest.mockClear();
    accountFindMany.mockClear();
  });

  test("exposes the browser session token endpoint", async () => {
    const { sessionRouter } = await import("./session");

    const response = await sessionRouter.handle(
      new Request("http://localhost/token"),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: "GET",
      pathname: "/token",
      search: "",
    });
  });

  test("exposes the normalized auth session state endpoint", async () => {
    const { sessionRouter } = await import("./session");

    const response = await sessionRouter.handle(
      new Request("http://localhost/get-session-state"),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: "GET",
      pathname: "/api/auth/get-session",
      search: "?disableRefresh=true",
    });
  });

  test("returns typed unauthorized response for missing session state", async () => {
    handleAuthRequest.mockImplementationOnce(() => Response.json(null));

    const { sessionRouter } = await import("./session");

    const response = await sessionRouter.handle(
      new Request("http://localhost/get-session-state"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "AUTH_SESSION_INVALID",
        message: "Auth session is invalid or expired",
      },
    });
  });

  test("returns pending verification state for unverified auth sessions", async () => {
    handleAuthRequest.mockImplementationOnce(() =>
      Response.json({
        session: {
          id: "session-1",
          token: "token-1",
          expiresAt: "2030-01-01T00:00:00.000Z",
          userId: "auth-user-1",
        },
        user: {
          id: "auth-user-1",
          name: "Reader",
          role: "user",
          email: "reader@example.com",
          emailVerified: false,
          image: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    const { sessionRouter } = await import("./session");

    const response = await sessionRouter.handle(
      new Request("http://localhost/get-session-state"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      authAccountState: {
        email: "reader@example.com",
        emailVerified: false,
        mainUserExists: false,
        registrationComplete: false,
        canAcquireMemberToken: false,
        readinessStatus: "pending-verification",
        pendingRegistration: {
          active: true,
          step: "verify-email",
          requiresEmailVerification: true,
          requiresMainAccountSetup: false,
        },
      },
    });
  });

  test("exposes password reset request and completion endpoints", async () => {
    const { passwordRouter } = await import("./password");

    const requestResetResponse = await passwordRouter.handle(
      new Request("http://localhost/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "reader@example.com",
          redirectTo: "http://localhost:3000/reset-password",
        }),
      }),
    );

    const callbackResponse = await passwordRouter.handle(
      new Request(
        "http://localhost/reset-password/reset-token?callbackURL=http://localhost:3000/reset-password",
      ),
    );

    const resetPasswordResponse = await passwordRouter.handle(
      new Request("http://localhost/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "reset-token",
          newPassword: "new-password",
        }),
      }),
    );

    expect(handleAuthRequest).toHaveBeenCalledTimes(3);
    expect(await requestResetResponse.json()).toEqual({
      method: "POST",
      pathname: "/request-password-reset",
      search: "",
    });
    expect(await callbackResponse.json()).toEqual({
      method: "GET",
      pathname: "/reset-password/reset-token",
      search: "?callbackURL=http://localhost:3000/reset-password",
    });
    expect(await resetPasswordResponse.json()).toEqual({
      method: "POST",
      pathname: "/reset-password",
      search: "",
    });
  });

  test("forwards sign-up requests without openapi runtime body validation", async () => {
    const { signInRouter } = await import("./sign-in");

    const response = await signInRouter.handle(
      new Request("http://localhost/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "reader@example.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: "POST",
      pathname: "/sign-up/email",
      search: "",
    });
  });

  test("forwards oauth authorize requests without openapi runtime query validation", async () => {
    const { oauthRouter } = await import("./oauth");

    const response = await oauthRouter.handle(
      new Request("http://localhost/oauth/authorize"),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: "GET",
      pathname: "/oauth/authorize",
      search: "",
    });
  });

  test("exposes public session and well-known jwks endpoints", async () => {
    const { sessionRouter } = await import("./session");
    const { oauthRouter } = await import("./oauth");

    const sessionJwksResponse = await sessionRouter.handle(
      new Request("http://localhost/session/jwks"),
    );
    const wellKnownJwksResponse = await oauthRouter.handle(
      new Request("http://localhost/.well-known/jwks.json"),
    );

    expect(sessionJwksResponse.status).toBe(200);
    expect(wellKnownJwksResponse.status).toBe(200);
    expect(handleAuthRequest).not.toHaveBeenCalled();
    expect(await sessionJwksResponse.json()).toEqual({
      pathname: "/api/auth/session/jwks",
    });
    expect(await wellKnownJwksResponse.json()).toEqual({
      pathname: "/api/auth/session/jwks",
    });
  });

  test("applies public cors to jwks and credentialed cors to browser session routes", async () => {
    const { sessionRouter } = await import("./session");

    const publicResponse = await sessionRouter.handle(
      new Request("http://localhost/session/jwks", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );
    const credentialedResponse = await sessionRouter.handle(
      new Request("http://localhost/token", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );

    expect(publicResponse.headers.get("access-control-allow-origin")).toBe(
      "https://rezics.com",
    );
    expect(
      publicResponse.headers.get("access-control-allow-credentials"),
    ).toBeNull();
    expect(
      credentialedResponse.headers.get("access-control-allow-origin"),
    ).toBe("https://rezics.com");
    expect(
      credentialedResponse.headers.get("access-control-allow-credentials"),
    ).toBe("true");
  });

  test("keeps oauth and discovery routes on public cors", async () => {
    const { oauthRouter } = await import("./oauth");

    const providersResponse = await oauthRouter.handle(
      new Request("http://localhost/providers", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );
    const discoveryResponse = await oauthRouter.handle(
      new Request("http://localhost/.well-known/openid-configuration", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );

    expect(providersResponse.headers.get("access-control-allow-origin")).toBe(
      "https://rezics.com",
    );
    expect(
      providersResponse.headers.get("access-control-allow-credentials"),
    ).toBeNull();
    expect(discoveryResponse.headers.get("access-control-allow-origin")).toBe(
      "https://rezics.com",
    );
    expect(
      discoveryResponse.headers.get("access-control-allow-credentials"),
    ).toBeNull();
  });

  test("exposes self-service auth endpoints without runtime validation blockers", async () => {
    const { selfServiceRouter } = await import("./self-service");

    const sendVerificationResponse = await selfServiceRouter.handle(
      new Request("http://localhost/send-verification-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "reader@example.com",
        }),
      }),
    );

    const verifyEmailResponse = await selfServiceRouter.handle(
      new Request("http://localhost/verify-email?token=verify-token"),
    );

    const changeEmailResponse = await selfServiceRouter.handle(
      new Request("http://localhost/change-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newEmail: "reader+new@example.com",
        }),
      }),
    );

    const setPasswordResponse = await selfServiceRouter.handle(
      new Request("http://localhost/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: "new-password",
        }),
      }),
    );

    expect(handleAuthRequest).toHaveBeenCalledTimes(4);
    expect(await sendVerificationResponse.json()).toEqual({
      method: "POST",
      pathname: "/send-verification-email",
      search: "",
    });
    expect(await verifyEmailResponse.json()).toEqual({
      method: "GET",
      pathname: "/verify-email",
      search: "?token=verify-token",
    });
    expect(await changeEmailResponse.json()).toEqual({
      method: "POST",
      pathname: "/change-email",
      search: "",
    });
    expect(await setPasswordResponse.json()).toEqual({
      method: "POST",
      pathname: "/set-password",
      search: "",
    });
  });

  test("forwards reset-password callback requests without openapi runtime query validation", async () => {
    const { passwordRouter } = await import("./password");

    const response = await passwordRouter.handle(
      new Request("http://localhost/reset-password/reset-token"),
    );

    expect(response.status).toBe(200);
    expect(handleAuthRequest).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({
      method: "GET",
      pathname: "/reset-password/reset-token",
      search: "",
    });
  });
});
