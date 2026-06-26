import {
  retryHistoryOutboxInputSchema,
  retryHistoryOutboxResponseSchema,
  type RetryHistoryOutboxResponse,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { historyOutbox } from "../db/schema";
import { authMacro, verifyAdminFromDb } from "../middleware/permission";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

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

      const db = await getServerDb();
      const result = await db
        .update(historyOutbox)
        .set({
          status: "pending",
          nextAttemptAt: new Date(),
          processedById: null,
          processedAt: null,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(historyOutbox.status, "failed"),
            body.unitId ? eq(historyOutbox.unitId, body.unitId) : undefined,
          ),
        )
        .returning({ id: historyOutbox.id });

      const response = {
        retried: result.length,
      } satisfies RetryHistoryOutboxResponse;

      return response;
    },
    {
      requireLogin: true,
      body: retryHistoryOutboxInputSchema,
      response: {
        200: retryHistoryOutboxResponseSchema,
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
