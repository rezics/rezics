import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { installPrismaClientMock } from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:3001";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "secret";
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

installPrismaClientMock();

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;
const getMeiliStatusSummary = mock(async () => ({ status: "available" }));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: (identity: { permission?: { role?: string } } | null) =>
    identity?.permission?.role === "ADMIN" ||
    identity?.permission?.role === "ROOT",
  verifyAdminFromDb: async () => dbAdmin,
  verifyRootFromDb: async () => false,
}));

mock.module("./status.service", () => ({
  getMeiliStatusSummary,
}));

mock.module("./search-client", () => ({
  searchClient: {
    checkHealth: async () => true,
  },
}));

describe("meiliApi status endpoint", () => {
  test("denies non-admin callers without querying Meili", async () => {
    const { meiliApi } = await import("./meili.api");
    const response = await meiliApi.handle(
      new Request("http://localhost/meili/status"),
    );

    expect(response.status).toBe(403);
    expect(getMeiliStatusSummary).not.toHaveBeenCalled();
  });

  test("allows admin callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    getMeiliStatusSummary.mockClear();

    const { meiliApi } = await import("./meili.api");
    const response = await meiliApi.handle(
      new Request("http://localhost/meili/status"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "available" });
    expect(getMeiliStatusSummary).toHaveBeenCalled();
  });
});
