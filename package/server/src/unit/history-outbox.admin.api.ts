import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { authMacro, verifyAdminFromDb } from "@/middleware/permission";

async function assertAdmin(identity: {
  userId: string;
  permission: { role: string };
}) {
  if (
    identity.permission.role !== "ADMIN" &&
    identity.permission.role !== "ROOT"
  ) {
    return false;
  }
  return verifyAdminFromDb(identity.userId);
}

export const historyOutboxAdminApi = new Elysia({
  prefix: "/admin/history-outbox",
})
  .use(authMacro)
  .post(
    "/retry-failed",
    async ({ identity, status, body }) => {
      if (!(await assertAdmin(identity))) {
        return status(403, "Forbidden: Admin role required");
      }

      const result = await prisma.historyOutbox.updateMany({
        where: {
          status: "failed",
          ...(body.unitId ? { unitId: body.unitId } : {}),
        },
        data: {
          status: "pending",
          nextAttemptAt: new Date(),
          processedById: null,
          processedAt: null,
          lastError: null,
        },
      });

      return { retried: result.count };
    },
    {
      requireLogin: true,
      body: t.Object({
        unitId: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({ retried: t.Number() }),
        403: t.String(),
      },
      detail: {
        summary: "Retry failed history outbox rows",
        description:
          "Moves failed HistoryOutbox rows back to pending for the history consumer. Optionally restricts retry to one Unit.",
        tags: ["Admin", "HistoryOutbox"],
      },
    },
  );
