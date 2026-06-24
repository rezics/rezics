import { describe, expect, mock, test } from "bun:test";
import { cors } from "@elysiajs/cors";
import { Elysia, status } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware/permission", () => ({
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
        const { verifyRezicsSessionToken } = await import(
          "@/session/jwt/jwt.service"
        );
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
        const { verifyRezicsProfileSetupToken } = await import(
          "@/session/jwt/jwt.service"
        );
        const setupIdentity = await verifyRezicsProfileSetupToken(
          decodeURIComponent(token),
        );
        if (!setupIdentity) return status(401, "Unauthorized");
        return { setupIdentity };
      },
    }),
  tryResolveIdentity: async (authorization?: string, cookieHeader?: string) => {
    const token =
      authorization ??
      cookieHeader
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("rezics-session-token="))
        ?.slice("rezics-session-token=".length);
    if (!token) return null;
    const { verifyRezicsSessionToken } = await import(
      "@/session/jwt/jwt.service"
    );
    return verifyRezicsSessionToken(decodeURIComponent(token));
  },
  isAdminRole: () => false,
  verifyAdminFromDb: async () => true,
  verifyRootFromDb: async () => true,
}));

mock.module("./echokv.service", () => ({
  echoKvService: {
    listKeys: async () => ["alpha", "beta"],
    get: async () => ({ value: "ok" }),
    set: async () => ({ value: "ok" }),
  },
}));

describe("echokv router cors", () => {
  test("keeps non-session feature routes on credentialed cors", async () => {
    const { echoKvApi } = await import("./echokv.api");
    const app = new Elysia()
      .use(
        cors({
          origin: ["https://rezics.com"],
          credentials: true,
        }),
      )
      .use(echoKvApi);

    const response = await app.handle(
      new Request("http://localhost/echokv/list", {
        headers: {
          Origin: "https://rezics.com",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://rezics.com",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(await response.json()).toEqual({
      keys: ["alpha", "beta"],
    });
  });
});
