import { describe, expect, mock, test } from "bun:test";
import type { AdminAuthUserAccountSummary } from "@rezics/contract";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;
let dbRoot = false;

const getAuthUserAccountSummaries = mock(
  async (): Promise<AdminAuthUserAccountSummary[]> => [
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
  ],
);
const listAuthUserSessions = mock(async () => ({
  sessions: [
    {
      id: "session-1",
      authUserId: "auth-user-1",
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:00:00.000Z",
      expiresAt: "2026-06-28T00:00:00.000Z",
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      impersonatedBy: null,
    },
  ],
}));
const revokeAuthUserSession = mock(async () => ({
  success: true,
  revokedSessions: 1,
  auditLogId: "audit-1",
}));
const revokeAuthUserSessions = mock(async () => ({
  success: true,
  revokedSessions: 2,
  auditLogId: "audit-2",
}));
const startAuthUserImpersonation = mock(async () => ({
  success: true,
  targetAuthUserId: "auth-user-1",
  startedAt: "2026-05-28T00:00:00.000Z",
  expiresAt: "2026-05-28T00:15:00.000Z",
  durationSeconds: 900,
  auditLogId: "audit-impersonation-1",
  authSessionCookie:
    "better-auth.session_token=impersonation-token; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=900",
}));

mock.module("@/middleware/permission", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  verifyAdminFromDb: async () => dbAdmin,
  verifyRootFromDb: async () => dbRoot,
}));

mock.module("./account-operation.service", () => ({
  getAuthUserAccountSummaries,
  listAuthUserSessions,
  revokeAuthUserSession,
  revokeAuthUserSessions,
  startAuthUserImpersonation,
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

  test("returns missing main profile reconciliation warnings", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    getAuthUserAccountSummaries.mockResolvedValueOnce([
      {
        authUserId: "auth-user-2",
        accountEnforcement: {
          activeCount: 0,
          activeKinds: [],
        },
        reconciliationWarnings: [
          {
            code: "missing-main-profile",
            severity: "warning",
            message: "Auth user has no linked main-server profile.",
            suggestedAction: "Materialize or reconcile the main user profile.",
          },
        ],
      },
    ]);

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/summary",
        {
          method: "POST",
          body: JSON.stringify({ authUserIds: ["auth-user-2"] }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summaries: [
        {
          authUserId: "auth-user-2",
          accountEnforcement: {
            activeCount: 0,
            activeKinds: [],
          },
          reconciliationWarnings: [
            {
              code: "missing-main-profile",
              severity: "warning",
              message: "Auth user has no linked main-server profile.",
              suggestedAction:
                "Materialize or reconcile the main user profile.",
            },
          ],
        },
      ],
    });
  });

  test("allows admins to list safe session metadata", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    listAuthUserSessions.mockClear();

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/sessions",
        {
          method: "POST",
          body: JSON.stringify({ authUserId: "auth-user-1" }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await listAuthUserSessions());
  });

  test("passes revoke reasons through with the actor identity", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = true;
    revokeAuthUserSession.mockClear();

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/sessions/revoke",
        {
          method: "POST",
          body: JSON.stringify({
            authUserId: "auth-user-1",
            sessionId: "session-1",
            reason: "operator review",
          }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(revokeAuthUserSession).toHaveBeenCalledWith({
      authUserId: "auth-user-1",
      sessionId: "session-1",
      reason: "operator review",
      actorUserId: "admin-1",
    });
  });

  test("requires root and sets auth cookie when starting impersonation", async () => {
    currentIdentity = {
      sub: "root-1",
      userId: "root-1",
      permission: { role: "ROOT" },
    };
    dbRoot = true;
    startAuthUserImpersonation.mockClear();

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/impersonate",
        {
          method: "POST",
          body: JSON.stringify({
            targetAuthUserId: "auth-user-1",
            reason: "support review",
            durationSeconds: 900,
          }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "better-auth.session_token=impersonation-token",
    );
    expect(await response.json()).toEqual({
      success: true,
      targetAuthUserId: "auth-user-1",
      startedAt: "2026-05-28T00:00:00.000Z",
      expiresAt: "2026-05-28T00:15:00.000Z",
      durationSeconds: 900,
      auditLogId: "audit-impersonation-1",
    });
    expect(startAuthUserImpersonation).toHaveBeenCalledWith({
      targetAuthUserId: "auth-user-1",
      reason: "support review",
      durationSeconds: 900,
      actorUserId: "root-1",
    });
  });

  test("denies impersonation for non-root admins without starting a session", async () => {
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbRoot = false;
    startAuthUserImpersonation.mockClear();

    const { accountOperationsAdminApi } = await import(
      "./account-operation.admin.api"
    );
    const response = await accountOperationsAdminApi.handle(
      new Request(
        "http://localhost/admin/account-operation/auth-users/impersonate",
        {
          method: "POST",
          body: JSON.stringify({
            targetAuthUserId: "auth-user-1",
            reason: "support review",
            durationSeconds: 900,
          }),
          headers: { "content-type": "application/json" },
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden: Root role required");
    expect(startAuthUserImpersonation).not.toHaveBeenCalled();
  });
});
