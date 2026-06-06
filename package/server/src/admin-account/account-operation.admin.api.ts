import {
  adminAuthSessionMutationResponseSchema,
  adminAuthUserAccountSummaryRequestSchema,
  adminAuthUserAccountSummaryResponseSchema,
  adminAuthUserSessionsRequestSchema,
  adminAuthUserSessionsResponseSchema,
  adminRevokeAuthSessionRequestSchema,
  adminRevokeAuthUserSessionsRequestSchema,
  adminStartAuthImpersonationRequestSchema,
  adminStartAuthImpersonationResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import {
  authMacro,
  verifyAdminFromDb,
  verifyRootFromDb,
} from "@/middleware/permission";
import {
  getAuthUserAccountSummaries,
  listAuthUserSessions,
  revokeAuthUserSession,
  revokeAuthUserSessions,
  startAuthUserImpersonation,
} from "./account-operation.service";

async function assertAdmin(identity: any, status: any) {
  if (
    identity.permission.role !== "ADMIN" &&
    identity.permission.role !== "ROOT"
  ) {
    return status(403, "Forbidden: Admin role required");
  }
  const isAdmin = await verifyAdminFromDb(identity.userId);
  if (!isAdmin) return status(403, "Forbidden: Admin role required");
}

async function assertRoot(identity: any, status: any) {
  if (identity.permission.role !== "ROOT") {
    return status(403, "Forbidden: Root role required");
  }
  const isRoot = await verifyRootFromDb(identity.userId);
  if (!isRoot) return status(403, "Forbidden: Root role required");
}

export const accountOperationsAdminApi = new Elysia({
  prefix: "/admin/account-operation",
})
  .use(authMacro)
  .post(
    "/auth-users/summary",
    async ({ body, identity, status }) => {
      const forbidden = await assertAdmin(identity, status);
      if (forbidden) return forbidden;

      const summaries = await getAuthUserAccountSummaries(body);
      return { summaries };
    },
    {
      requireLogin: true,
      body: adminAuthUserAccountSummaryRequestSchema,
      response: {
        200: adminAuthUserAccountSummaryResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Summarize auth users against main account operations state",
        description:
          "Returns main-user linkage, enforcement summary, and reconciliation warnings for auth users.",
        tags: ["Admin", "Account Operations"],
      },
    },
  )
  .post(
    "/auth-users/sessions",
    async ({ body, identity, status }) => {
      const forbidden = await assertAdmin(identity, status);
      if (forbidden) return forbidden;

      return listAuthUserSessions(body);
    },
    {
      requireLogin: true,
      body: adminAuthUserSessionsRequestSchema,
      response: {
        200: adminAuthUserSessionsResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "List safe auth session metadata for an auth user",
        description:
          "Returns session identifiers and safe device metadata without exposing raw session tokens.",
        tags: ["Admin", "Account Operations"],
      },
    },
  )
  .post(
    "/auth-users/sessions/revoke",
    async ({ body, identity, status }) => {
      const forbidden = await assertAdmin(identity, status);
      if (forbidden) return forbidden;

      return revokeAuthUserSession({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRevokeAuthSessionRequestSchema,
      response: {
        200: adminAuthSessionMutationResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Revoke one auth user session with staff audit",
        tags: ["Admin", "Account Operations"],
      },
    },
  )
  .post(
    "/auth-users/sessions/revoke-all",
    async ({ body, identity, status }) => {
      const forbidden = await assertAdmin(identity, status);
      if (forbidden) return forbidden;

      return revokeAuthUserSessions({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRevokeAuthUserSessionsRequestSchema,
      response: {
        200: adminAuthSessionMutationResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Revoke all sessions for an auth user with staff audit",
        tags: ["Admin", "Account Operations"],
      },
    },
  )
  .post(
    "/auth-users/impersonate",
    async ({ body, identity, set, status }) => {
      const forbidden = await assertRoot(identity, status);
      if (forbidden) return forbidden;

      const result = await startAuthUserImpersonation({
        ...body,
        actorUserId: identity.userId,
      });
      set.headers["set-cookie"] = result.authSessionCookie;
      const { authSessionCookie: _authSessionCookie, ...response } = result;
      return response;
    },
    {
      requireLogin: true,
      body: adminStartAuthImpersonationRequestSchema,
      response: {
        200: adminStartAuthImpersonationResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Start owner-only auth user impersonation",
        description:
          "Creates a short-lived impersonation auth session, captures a staff audit reason, and sets the auth session cookie for the admin browser.",
        tags: ["Admin", "Account Operations"],
      },
    },
  );
