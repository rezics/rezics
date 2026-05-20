import type {
  HistoryActorResolutionBatchResponse,
  HistoryUnitReferenceResolutionBatchResponse,
} from "@rezics/contract";
import {
  historyActorResolutionBatchResponseSchema,
  historyUnitReferenceResolutionBatchResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { isAdminRole, tryResolveIdentity } from "@/middleware";

const batchBodySchema = t.Object({
  ids: t.Array(t.String(), { maxItems: 100 }),
});

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
}

export const historyResolutionApi = new Elysia({
  prefix: "/history/resolve",
})
  .post(
    "/actors",
    async ({ body }): Promise<HistoryActorResolutionBatchResponse> => {
      const ids = uniqueIds(body.ids);
      if (ids.length === 0) return { actors: {} };

      const userScope = requireSlugScopeId("user");
      const [users, units] = await Promise.all([
        prisma.user.findMany({
          where: { unitId: { in: ids } },
          select: { unitId: true, name: true, avatar: true },
        }),
        prisma.unit.findMany({
          where: { id: { in: ids }, slugScope: userScope, type: "USER" },
          select: { id: true, slug: true, status: true },
        }),
      ]);
      const userById = new Map(users.map((user) => [user.unitId, user]));
      const unitById = new Map(units.map((unit) => [unit.id, unit]));

      const actors: HistoryActorResolutionBatchResponse["actors"] = {};
      for (const id of ids) {
        const user = userById.get(id);
        const unit = unitById.get(id);
        if (user && unit?.status !== "DELETED") {
          actors[id] = {
            actorUserId: id,
            status: "OK",
            displayName: user.name ?? unit?.slug ?? undefined,
            handle: unit?.slug ?? undefined,
            avatarUrl: user.avatar,
          };
        } else {
          actors[id] = { actorUserId: id, status: "DELETED" };
        }
      }

      return { actors };
    },
    {
      body: batchBodySchema,
      response: historyActorResolutionBatchResponseSchema,
      detail: {
        summary: "Resolve history actors",
        tags: ["History"],
      },
    },
  )
  .post(
    "/units",
    async ({
      body,
      headers,
    }): Promise<HistoryUnitReferenceResolutionBatchResponse> => {
      const ids = uniqueIds(body.ids);
      if (ids.length === 0) return { units: {} };

      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const admin = isAdminRole(identity);
      const rows = await prisma.unit.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          type: true,
          slug: true,
          status: true,
          visibility: true,
          userId: true,
          translations: {
            select: { title: true, language: true },
            take: 1,
            orderBy: { language: "asc" },
          },
        },
      });
      const rowById = new Map(rows.map((row) => [row.id, row]));

      const units: HistoryUnitReferenceResolutionBatchResponse["units"] = {};
      for (const id of ids) {
        const row = rowById.get(id);
        if (!row) {
          units[id] = { unitId: id, status: "GONE" };
          continue;
        }
        if (row.status === "DELETED") {
          units[id] = { unitId: id, status: "DELETED" };
          continue;
        }
        if (
          !admin &&
          row.visibility !== "PUBLIC" &&
          row.userId !== identity?.userId
        ) {
          units[id] = { unitId: id, status: "RESTRICTED" };
          continue;
        }
        units[id] = {
          unitId: id,
          status: "OK",
          title: row.translations[0]?.title ?? row.slug ?? id,
          unitType: row.type,
          slug: row.slug,
        };
      }

      return { units };
    },
    {
      body: batchBodySchema,
      response: historyUnitReferenceResolutionBatchResponseSchema,
      detail: {
        summary: "Resolve history Unit references",
        tags: ["History"],
      },
    },
  );
