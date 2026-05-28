import {
  adminAuthUserAccountSummaryRequestSchema,
  adminAuthUserAccountSummaryResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware/permission";
import { getAuthUserAccountSummaries } from "./account-operation.service";

export const accountOperationsAdminApi = new Elysia({
  prefix: "/admin/account-operation",
})
  .use(authMacro)
  .post(
    "/auth-users/summary",
    async ({ body, identity, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

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
  );
