import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NOTIFY_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_notify";
process.env.NOTIFY_INTERNAL_SECRET ??= "test-notify-secret";
process.env.SERVER_JWKS_URL ??= "http://localhost:3000/.well-known/jwks.json";
process.env.SERVER_ISSUER ??= "rezics-server";

describe("readCookie", () => {
  test("extracts cookie value by name", async () => {
    const { readCookie } = await import("./auth");
    expect(
      readCookie(
        "foo=bar; rezics-session-token=abc.def.ghi",
        "rezics-session-token",
      ),
    ).toBe("abc.def.ghi");
  });

  test("returns null when cookie header is empty", async () => {
    const { readCookie } = await import("./auth");
    expect(readCookie(undefined, "rezics-session-token")).toBe(null);
    expect(readCookie("", "rezics-session-token")).toBe(null);
  });

  test("returns null when name does not match", async () => {
    const { readCookie } = await import("./auth");
    expect(readCookie("other=1", "rezics-session-token")).toBe(null);
  });

  test("URL-decodes value", async () => {
    const { readCookie } = await import("./auth");
    expect(readCookie("x=hello%20world", "x")).toBe("hello world");
  });
});

describe("resolveSessionToken", () => {
  test("returns Authorization value with Bearer prefix stripped", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(resolveSessionToken("Bearer my.jwt.token", undefined)).toBe(
      "my.jwt.token",
    );
  });

  test("returns Authorization value with case-insensitive Bearer prefix", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(resolveSessionToken("bearer my.jwt.token", undefined)).toBe(
      "my.jwt.token",
    );
  });

  test("returns cookie value when Authorization absent", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(
      resolveSessionToken(undefined, "rezics-session-token=cookie.jwt.token"),
    ).toBe("cookie.jwt.token");
  });

  test("Authorization takes precedence when both present", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(
      resolveSessionToken(
        "Bearer header.jwt",
        "rezics-session-token=cookie.jwt",
      ),
    ).toBe("header.jwt");
  });

  test("returns null when neither Authorization nor cookie has a token", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(resolveSessionToken(undefined, undefined)).toBe(null);
    expect(resolveSessionToken(undefined, "other=1")).toBe(null);
  });

  test("returns Authorization raw value when no Bearer prefix", async () => {
    const { resolveSessionToken } = await import("./auth");
    expect(resolveSessionToken("raw.jwt.token", undefined)).toBe(
      "raw.jwt.token",
    );
  });
});

describe("authMacro", () => {
  test("rejects requests without Authorization or rezics-session-token", async () => {
    const { authMacro } = await import("./auth");
    const app = new Elysia()
      .use(authMacro)
      .get("/stream", ({ userId }) => ({ userId }), {
        requireUser: true,
      });

    const response = await app.handle(new Request("http://localhost/stream"));

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized: Missing token");
  });
});
