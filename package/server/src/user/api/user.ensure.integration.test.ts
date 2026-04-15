/**
 * Integration test for GET /users/ensure.
 *
 * This test exercises the real token-resolver → JWT verification → requireLogin
 * → ensure handler chain with no mocks. It requires a live auth service and
 * database.
 *
 * Provide the following environment variables:
 *
 *   AUTH_SESSION_TOKEN   – A valid auth-session JWT (Bearer value only)
 *   AUTH_CONTEXT_TOKEN    – (optional) A valid auth-context JWT for first-time provisioning
 *
 * Run:
 *   AUTH_SESSION_TOKEN="ey..." bun test src/user/api/user.ensure.integration.test.ts
 */
import { describe, expect, test } from "bun:test";

const AUTH_SESSION_TOKEN = process.env.AUTH_SESSION_TOKEN;
const AUTH_CONTEXT_TOKEN = process.env.AUTH_CONTEXT_TOKEN;
const SERVER_BASE_URL = process.env.SERVER_BASE_URL ?? "http://localhost:3000";

const describeWithToken = AUTH_SESSION_TOKEN ? describe : describe.skip;

describeWithToken("GET /users/ensure (integration)", () => {
  test("returns 200 with a valid auth session token", async () => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${AUTH_SESSION_TOKEN}`,
    };

    if (AUTH_CONTEXT_TOKEN) {
      headers["x-auth-context-token"] = AUTH_CONTEXT_TOKEN;
    }

    const response = await fetch(`${SERVER_BASE_URL}/users/ensure`, {
      headers,
    });

    const body = await response.json();

    console.log("Status:", response.status);
    console.log("Body:", JSON.stringify(body, null, 2));

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("user");
    expect(body).toHaveProperty("alreadyCreated");
    expect(body.user).toHaveProperty("unitId");
  });

  test("returns 401 without a token", async () => {
    const response = await fetch(`${SERVER_BASE_URL}/users/ensure`);

    expect(response.status).toBe(401);

    const body = await response.json();
    console.log("No-token response:", JSON.stringify(body, null, 2));
  });

  test("returns 401 with a garbage token and shows the reason", async () => {
    const response = await fetch(`${SERVER_BASE_URL}/users/ensure`, {
      headers: {
        Authorization: "Bearer not.a.valid-token",
      },
    });

    expect(response.status).toBe(401);

    const body = await response.json();
    console.log("Bad-token response:", JSON.stringify(body, null, 2));

    // The improved error message should surface the verification reason
    expect(body.message).toContain("Unauthorized");
    expect(body.message).not.toBe("Unauthorized: Invalid token");
  });
});
