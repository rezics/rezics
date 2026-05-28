import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;

const getAuthUserAccountSummaries = mock(async () => [
  {
    authUserId: "auth-user-1",
    mainUser: {
      unitId: "main-user-1",
      slug: "reader",
      name: "Reader",
      email: "reader@example.com",
      role: ["MEMBER"],
    },
    accountEnforcement: {
      activeCount: 0,
      activeKinds: [],
    },
    reconciliationWarnings: [],
  },
]);

mock.module("@/middleware/permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  verifyAdminFromDb: async () => dbAdmin,
}));

mock.module("./account-operation.service", () => ({
  getAuthUserAccountSummaries,
}));

describe("accountOperationsAdminApi", () => {
  test("denies non-admin summary callers without reading account state", async () => {
    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/summary",
        {
          method: "POST",
          body: JSON.stringify({ authUserIds: ["auth-user-1"] }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(getAuthUserAccountSummaries).not.toHaveBeenCalled();
  });

  test("allows admin summary callers", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    getAuthUserAccountSummaries.mockClear();

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/summary",
        {
          method: "POST",
          body: JSON.stringify({ authUserIds: ["auth-user-1"] }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summaries: await getAuthUserAccountSummaries(),
    });
  });
});
