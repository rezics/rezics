import { Elysia } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { getSystemStatusSummary } from "./system-status.service";

export const statusApi = new Elysia({ prefix: "/diagnostic" })
  .use(authMacro)
  .get(
    "/system",
    async ({ identity, set }) => {
      if (!isAdminRole(identity)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }

      return getSystemStatusSummary();
    },
    {
      requireLogin: true,
      detail: {
        summary: "Internal system status summary",
        tags: ["Status", "Admin"],
      },
    },
  );
