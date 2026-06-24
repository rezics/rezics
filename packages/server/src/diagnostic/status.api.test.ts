import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;
const getSystemStatusSummary = mock(async () => ({ status: "available" }));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: (identity: { permission?: { role?: string } } | null) =>
    identity?.permission?.role === "ADMIN" ||
    identity?.permission?.role === "ROOT",
  verifyAdminFromDb: async () => dbAdmin,
}));

mock.module("./system-status.service", () => ({
  getSystemStatusSummary,
}));

describe("statusApi", () => {
  test("denies non-admin callers without probing status dependencies", async () => {
    const { statusApi } = await import("./status.api");
    const response = await statusApi.handle(
      new Request("http://localhost/diagnostic/system"),
    );

    expect(response.status).toBe(403);
    expect(getSystemStatusSummary).not.toHaveBeenCalled();
  });

  test("allows admin callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    getSystemStatusSummary.mockClear();

    const { statusApi } = await import("./status.api");
    const response = await statusApi.handle(
      new Request("http://localhost/diagnostic/system"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "available" });
    expect(getSystemStatusSummary).toHaveBeenCalled();
  });
});
