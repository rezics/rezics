import type {
  HistoryActorResolutionBatchResponse,
  HistoryUnitReferenceResolutionBatchResponse,
} from "@rezics/contract";
import {
  historyActorResolutionBatchResponseSchema,
  historyUnitReferenceResolutionBatchResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { Unit, UnitTranslation, User } from "../db/schema";
import { requireSlugScopeId } from "../infra/slug-scopes";
import { isAdminRole, tryResolveIdentity } from "../middleware";

const batchBodySchema = t.Object({
  ids: t.Array(t.String(), { maxItems: 100 }),
});

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
}

type HistoryActorUserRow = Pick<
  typeof User.$inferSelect,
  "unitId" | "name" | "avatar"
>;
type HistoryActorUnitRow = Pick<
  typeof Unit.$inferSelect,
  "id" | "slug" | "status"
>;
type HistoryUnitReferenceRow = Pick<
  typeof Unit.$inferSelect,
  "id" | "type" | "slug" | "status" | "visibility" | "userId"
> & {
  translations: Array<
    Pick<typeof UnitTranslation.$inferSelect, "title" | "language">
  >;
};

export type HistoryResolutionRepository = {
  findActorUsers(ids: readonly string[]): Promise<HistoryActorUserRow[]>;
  findActorUnits(input: {
    ids: readonly string[];
    userScope: string;
  }): Promise<HistoryActorUnitRow[]>;
  findUnitReferences(
    ids: readonly string[],
  ): Promise<HistoryUnitReferenceRow[]>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleHistoryResolutionRepository(): HistoryResolutionRepository {
  return {
    async findActorUsers(ids) {
      const db = await getServerDb();
      return db
        .select({ unitId: User.unitId, name: User.name, avatar: User.avatar })
        .from(User)
        .where(inArray(User.unitId, [...ids]));
    },

    async findActorUnits({ ids, userScope }) {
      const db = await getServerDb();
      return db
        .select({ id: Unit.id, slug: Unit.slug, status: Unit.status })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, [...ids]),
            eq(Unit.slugScope, userScope),
            eq(Unit.type, "USER"),
          ),
        );
    },

    async findUnitReferences(ids) {
      const db = await getServerDb();
      const rows = await db
        .select({
          id: Unit.id,
          type: Unit.type,
          slug: Unit.slug,
          status: Unit.status,
          visibility: Unit.visibility,
          userId: Unit.userId,
        })
        .from(Unit)
        .where(inArray(Unit.id, [...ids]));

      if (rows.length === 0) {
        return [];
      }

      const translations = await db
        .select({
          unitId: UnitTranslation.unitId,
          title: UnitTranslation.title,
          language: UnitTranslation.language,
        })
        .from(UnitTranslation)
        .where(
          inArray(
            UnitTranslation.unitId,
            rows.map((row) => row.id),
          ),
        );

      const translationsByUnitId = new Map<
        string,
        HistoryUnitReferenceRow["translations"]
      >();
      for (const translation of translations) {
        const list = translationsByUnitId.get(translation.unitId) ?? [];
        list.push({
          title: translation.title,
          language: translation.language,
        });
        translationsByUnitId.set(translation.unitId, list);
      }

      for (const list of translationsByUnitId.values()) {
        list.sort((a, b) => a.language.localeCompare(b.language));
      }

      return rows.map((row) => ({
        ...row,
        translations: (translationsByUnitId.get(row.id) ?? []).slice(0, 1),
      }));
    },
  };
}

export function createHistoryResolutionApi(
  repository: HistoryResolutionRepository = createDrizzleHistoryResolutionRepository(),
) {
  return new Elysia({
    prefix: "/history/resolve",
  })
    .post(
      "/actors",
      async ({ body }): Promise<HistoryActorResolutionBatchResponse> => {
        const ids = uniqueIds(body.ids);
        if (ids.length === 0) return { actors: {} };

        const userScope = requireSlugScopeId("user");
        const [users, units] = await Promise.all([
          repository.findActorUsers(ids),
          repository.findActorUnits({ ids, userScope }),
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
        const rows = await repository.findUnitReferences(ids);
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
}

export const historyResolutionApi = createHistoryResolutionApi();
