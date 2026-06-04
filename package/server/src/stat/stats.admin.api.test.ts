import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;

const getDashboardSummary = mock(async () => ({
  checkedAt: "2026-05-28T00:00:00.000Z",
  system: {
    status: "available",
    affectedItems: 0,
    link: "/status",
  },
  queue: {
    status: "available",
    lanes: 0,
    activeJobs: 0,
    retryJobs: 0,
    failedJobs: 0,
    link: "/status",
  },
  search: {
    status: "available",
    driftedIndexes: 0,
    indexingIndexes: 0,
    failedTasks: 0,
    documentCount: 0,
    link: "/meili",
  },
  governance: {
    openCases: 0,
    escalatedCases: 0,
    realmCasesOpen: 0,
    realmCasesEscalated: 0,
    activeEnforcements: 0,
    link: "/realm",
  },
  audit: {
    recent: [],
    link: "/realm",
  },
  repairWarnings: [],
}));

mock.module("@/middleware/permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  verifyAdminFromDb: async () => dbAdmin,
}));

mock.module("./stats.service", () => ({
  statsService: {
    getDashboardSummary,
    getStats: mock(async () => ({})),
  },
}));

describe("statsAdminApi", () => {
  test("denies non-admin dashboard summary callers without aggregating", async () => {
    const { statsAdminApi } = await import("./stats.admin.api");
    const response = await statsAdminApi.handle(
      new Request("http://localhost/admin/stats/dashboard-summary"),
    );

    expect(response.status).toBe(403);
    expect(getDashboardSummary).not.toHaveBeenCalled();
  });

  test("allows admin dashboard summary callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    getDashboardSummary.mockClear();

    const { statsAdminApi } = await import("./stats.admin.api");
    const response = await statsAdminApi.handle(
      new Request("http://localhost/admin/stats/dashboard-summary"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getDashboardSummary());
  });
});
