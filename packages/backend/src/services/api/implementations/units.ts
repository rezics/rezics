import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  Unit,
  UnitAlias,
  UnitAliasVote,
  UnitCollaborator,
  UnitExternalLink,
  UnitFieldLock,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  AliasDTO,
  AliasListResult,
  AliasNotFound,
  CollaboratorDTO,
  ExternalLinkDTO,
  ExternalLinkListResult,
  ExternalLinkNotFound,
  FieldLockDTO,
  InvalidSlug,
  TranslationDTO,
  TranslationNotFound,
  TranslationSourceDTO,
  UnitDTO,
  UnitForbidden,
  UnitListResult,
  UnitNotFound,
} from "../interfaces/units.ts";

// ---------------------------------------------------------------------------
// Mappers — grow when DTOs expand / 映射函数——DTO 扩展时同步增长
// ---------------------------------------------------------------------------

function unitToDTO(r: typeof Unit.$inferSelect) {
  return new UnitDTO({
    id: r.id,
    type: r.type,
    slug: r.slug ?? null,
    status: r.status,
    visibility: r.visibility,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}

function transToDTO(r: typeof UnitTranslation.$inferSelect) {
  return new TranslationDTO({
    unitId: r.unitId,
    language: r.language,
    title: r.title ?? null,
    subtitle: r.subtitle ?? null,
    summary: r.summary ?? null,
  });
}

function aliasToDTO(r: typeof UnitAlias.$inferSelect) {
  return new AliasDTO({
    id: r.id,
    unitId: r.unitId,
    value: r.value,
    normalizedValue: r.normalizedValue,
    score: r.score,
  });
}

function collabToDTO(r: typeof UnitCollaborator.$inferSelect) {
  return new CollaboratorDTO({ unitId: r.unitId, userId: r.userId, role: r.roleKey });
}

function lockToDTO(r: typeof UnitFieldLock.$inferSelect) {
  return new FieldLockDTO({ unitId: r.unitId, path: r.path, lockedBy: r.lockedById });
}

function extLinkToDTO(r: typeof UnitExternalLink.$inferSelect) {
  return new ExternalLinkDTO({
    id: r.id,
    unitId: r.unitId,
    url: r.url,
    label: r.fallbackText ?? null,
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const UnitsHandlers = HttpApiBuilder.group(
  Api,
  "units",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    return handlers
      // ── Unit CRUD ──────────────────────────────────────────────
      .handle("getUnit", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!rows[0]) return yield* new UnitNotFound();
          return unitToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      .handle("createUnit", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* database
              .insert(Unit)
              .values({
                type: payload.type,
                userId: user.id,
                slugScope: user.id,
                slug: payload.slug,
                defaultLanguage: payload.defaultLanguage ?? "en",
                status: "DRAFT",
              })
              .returning();
          return unitToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("updateUnit", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const existing = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!existing[0]) return yield* new UnitNotFound();
          if (existing[0].userId !== user.id) return yield* new UnitForbidden();
          const set: Record<string, unknown> = { updatedAt: new Date() };
          if (payload.status) set["status"] = payload.status;
          if (payload.visibility) set["visibility"] = payload.visibility;
          if (payload.rating) set["rating"] = payload.rating;
          if (payload.defaultLanguage) set["defaultLanguage"] = payload.defaultLanguage;
          const rows = yield* database.update(Unit).set(set).where(eq(Unit.id, params.unitId)).returning();
          return unitToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("deleteUnit", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const existing = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!existing[0]) return yield* new UnitNotFound();
          if (existing[0].userId !== user.id) return yield* new UnitForbidden();
          yield* database.delete(Unit).where(eq(Unit.id, params.unitId));
        }).pipe(Effect.orDie),
      )

      .handle("listUnits", ({ payload }) =>
        Effect.gen(function* () {
          const conditions: ReturnType<typeof eq>[] = [];
          if (payload.type) conditions.push(eq(Unit.type, payload.type));
          if (payload.status) conditions.push(eq(Unit.status, payload.status));
          if (payload.visibility) conditions.push(eq(Unit.visibility, payload.visibility));
          if (payload.userId) conditions.push(eq(Unit.userId, payload.userId));
          if (payload.ids && payload.ids.length > 0) conditions.push(inArray(Unit.id, [...payload.ids]));
          if (payload.search) conditions.push(ilike(Unit.slug, `%${payload.search}%`));
          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const rows = yield* database
              .select()
              .from(Unit)
              .where(where)
              .orderBy(desc(Unit.createdAt))
              .limit(lim(payload.limit))
              .offset(payload.offset ?? 0);
          const agg = yield* database.select({ total: count() }).from(Unit).where(where);
          return new UnitListResult({ units: rows.map(unitToDTO), total: agg[0]?.total ?? 0 });
        }).pipe(Effect.orDie),
      )

      // ── Slug ───────────────────────────────────────────────────
      .handle("setUnitSlug", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const existing = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!existing[0]) return yield* new UnitNotFound();
          if (existing[0].userId !== user.id) return yield* new UnitForbidden();
          if (!/^[a-z0-9][a-z0-9_-]*$/.test(payload.slug)) return yield* new InvalidSlug();
          const rows = yield* database
              .update(Unit)
              .set({ slug: payload.slug, updatedAt: new Date() })
              .where(eq(Unit.id, params.unitId))
              .returning();
          return unitToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── Translations ──────────────────────────────────────────
      .handle("getTranslation", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* database
              .select()
              .from(UnitTranslation)
              .where(and(eq(UnitTranslation.unitId, params.unitId), eq(UnitTranslation.language, params.language)));
          if (!rows[0]) return yield* new TranslationNotFound();
          return transToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      .handle("upsertTranslation", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const patch = payload.patch;
          const set: Record<string, unknown> = { updatedAt: new Date() };
          if ("title" in patch) set["title"] = patch["title"];
          if ("subtitle" in patch) set["subtitle"] = patch["subtitle"];
          if ("summary" in patch) set["summary"] = patch["summary"];
          if ("description" in patch) set["description"] = patch["description"];
          if ("extra" in patch) set["extra"] = patch["extra"];
          const rows = yield* database
              .insert(UnitTranslation)
              .values({ unitId: params.unitId, language: params.language, ...set })
              .onConflictDoUpdate({
                target: [UnitTranslation.unitId, UnitTranslation.language],
                set,
              })
              .returning();
          return transToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("deleteTranslation", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const existing = yield* database
              .select()
              .from(UnitTranslation)
              .where(and(eq(UnitTranslation.unitId, params.unitId), eq(UnitTranslation.language, params.language)));
          if (!existing[0]) return yield* new TranslationNotFound();
          yield* database
              .delete(UnitTranslation)
              .where(and(eq(UnitTranslation.unitId, params.unitId), eq(UnitTranslation.language, params.language)));
        }).pipe(Effect.orDie),
      )

      .handle("setTranslationSource", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const rows = yield* database
              .update(UnitTranslation)
              .set({ sourceUnitId: payload.sourceUnitId ?? null, updatedAt: new Date() })
              .where(and(eq(UnitTranslation.unitId, params.unitId), eq(UnitTranslation.language, params.lang)))
              .returning();
          if (!rows[0]) return yield* new UnitNotFound();
          return new TranslationSourceDTO({
            unitId: rows[0].unitId,
            language: rows[0].language,
            sourceUnitId: rows[0].sourceUnitId ?? null,
          });
        }).pipe(Effect.orDie),
      )

      // ── Collaborators ─────────────────────────────────────────
      .handle("listCollaborators", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const rows = yield* database.select().from(UnitCollaborator).where(eq(UnitCollaborator.unitId, params.unitId));
          return { collaborators: rows.map(collabToDTO) };
        }).pipe(Effect.orDie),
      )

      .handle("upsertCollaborator", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* database
              .insert(UnitCollaborator)
              .values({
                unitId: params.unitId,
                userId: params.userId,
                roleKey: payload.role,
                addedById: user.id,
              })
              .onConflictDoUpdate({
                target: [UnitCollaborator.unitId, UnitCollaborator.userId],
                set: { roleKey: payload.role },
              })
              .returning();
          return collabToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("removeCollaborator", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* database
              .delete(UnitCollaborator)
              .where(and(eq(UnitCollaborator.unitId, params.unitId), eq(UnitCollaborator.userId, params.userId)));
        }).pipe(Effect.orDie),
      )

      // ── Field locks ───────────────────────────────────────────
      .handle("listFieldLocks", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const rows = yield* database.select().from(UnitFieldLock).where(eq(UnitFieldLock.unitId, params.unitId));
          return { locks: rows.map(lockToDTO) };
        }).pipe(Effect.orDie),
      )

      .handle("upsertFieldLock", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* database
              .insert(UnitFieldLock)
              .values({ unitId: params.unitId, path: params.path, lockedById: user.id, reason: payload.reason })
              .onConflictDoUpdate({
                target: [UnitFieldLock.unitId, UnitFieldLock.path],
                set: { reason: payload.reason, lockedById: user.id },
              })
              .returning();
          return lockToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("deleteFieldLock", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* database
              .delete(UnitFieldLock)
              .where(and(eq(UnitFieldLock.unitId, params.unitId), eq(UnitFieldLock.path, params.path)));
        }).pipe(Effect.orDie),
      )

      // ── Aliases ────────────────────────────────────────────────
      .handle("listAliases", ({ query }) =>
        Effect.gen(function* () {
          const conditions: ReturnType<typeof eq>[] = [];
          if (query.unitId) conditions.push(eq(UnitAlias.unitId, query.unitId));
          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const rows = yield* database
              .select()
              .from(UnitAlias)
              .where(where)
              .orderBy(desc(UnitAlias.score))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          const agg = yield* database.select({ total: count() }).from(UnitAlias).where(where);
          return new AliasListResult({ aliases: rows.map(aliasToDTO), total: agg[0]?.total ?? 0 });
        }).pipe(Effect.orDie),
      )

      .handle("createAlias", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* database
              .insert(UnitAlias)
              .values({
                unitId: payload.unitId,
                value: payload.value,
                normalizedValue: payload.value.toLowerCase().trim(),
                language: payload.language,
                createdById: user.id,
                updatedById: user.id,
              })
              .returning();
          return aliasToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("updateAlias", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const set: Record<string, unknown> = { updatedById: user.id, updatedAt: new Date() };
          if (payload.value) {
            set["value"] = payload.value;
            set["normalizedValue"] = payload.value.toLowerCase().trim();
          }
          if (payload.language !== undefined) set["language"] = payload.language;
          const rows = yield* database.update(UnitAlias).set(set).where(eq(UnitAlias.id, params.aliasId)).returning();
          if (!rows[0]) return yield* new AliasNotFound();
          return aliasToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      .handle("deleteAlias", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const deleted = yield* database.delete(UnitAlias).where(eq(UnitAlias.id, params.aliasId)).returning();
          if (deleted.length === 0) return yield* new AliasNotFound();
        }).pipe(Effect.orDie),
      )

      .handle("castAliasVote", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* database
              .insert(UnitAliasVote)
              .values({ aliasId: payload.aliasId, userId: user.id, value: payload.value })
              .onConflictDoUpdate({
                target: [UnitAliasVote.aliasId, UnitAliasVote.userId],
                set: { value: payload.value, updatedAt: new Date() },
              });
          // ponytail: recalculate aggregate inline / 内联重算聚合
          const agg = yield* database
              .select({ total: sql<number>`coalesce(sum(value), 0)`, cnt: count() })
              .from(UnitAliasVote)
              .where(eq(UnitAliasVote.aliasId, payload.aliasId));
          yield* database
              .update(UnitAlias)
              .set({ score: Number(agg[0]?.total ?? 0), voteCount: agg[0]?.cnt ?? 0, updatedAt: new Date() })
              .where(eq(UnitAlias.id, payload.aliasId));
          const rows = yield* database.select().from(UnitAlias).where(eq(UnitAlias.id, payload.aliasId));
          if (!rows[0]) return yield* new AliasNotFound();
          return aliasToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── External links ────────────────────────────────────────
      .handle("listExternalLinks", ({ query }) =>
        Effect.gen(function* () {
          const conditions: ReturnType<typeof eq>[] = [];
          if (query.unitId) conditions.push(eq(UnitExternalLink.unitId, query.unitId));
          if (query.sourceEntityUnitId)
            conditions.push(eq(UnitExternalLink.sourceEntityUnitId, query.sourceEntityUnitId));
          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const rows = yield* database
              .select()
              .from(UnitExternalLink)
              .where(where)
              .orderBy(UnitExternalLink.position)
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          const agg = yield* database.select({ total: count() }).from(UnitExternalLink).where(where);
          return new ExternalLinkListResult({ links: rows.map(extLinkToDTO), total: agg[0]?.total ?? 0 });
        }).pipe(Effect.orDie),
      )

      .handle("getExternalLinksForUnit", ({ params, query }) =>
        Effect.gen(function* () {
          const conditions = [eq(UnitExternalLink.unitId, params.unitId)];
          if (query.sourceEntityUnitId)
            conditions.push(eq(UnitExternalLink.sourceEntityUnitId, query.sourceEntityUnitId));
          const rows = yield* database.select().from(UnitExternalLink).where(and(...conditions)).orderBy(UnitExternalLink.position);
          return { links: rows.map(extLinkToDTO) };
        }).pipe(Effect.orDie),
      )

      .handle("batchExternalLinks", ({ payload }) =>
        Effect.gen(function* () {
          if (payload.unitIds.length === 0) {
            const empty: Record<string, ExternalLinkDTO[]> = {};
            return empty;
          }
          const rows = yield* database
              .select()
              .from(UnitExternalLink)
              .where(inArray(UnitExternalLink.unitId, [...payload.unitIds]))
              .orderBy(UnitExternalLink.position);
          const grouped: Record<string, ExternalLinkDTO[]> = {};
          for (const r of rows) (grouped[r.unitId] ??= []).push(extLinkToDTO(r));
          for (const id of payload.unitIds) grouped[id] ??= [];
          return grouped;
        }).pipe(Effect.orDie),
      )

      .handle("createExternalLink", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          if (!payload.sourceEntityUnitId) return yield* new UnitForbidden();
          const rows = yield* database
              .insert(UnitExternalLink)
              .values({
                unitId: payload.unitId,
                url: payload.url,
                fallbackText: payload.label ?? null,
                sourceEntityUnitId: payload.sourceEntityUnitId,
              })
              .returning();
          return extLinkToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      .handle("updateExternalLink", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const set: Record<string, unknown> = { updatedAt: new Date() };
          if (payload.url) set["url"] = payload.url;
          if (payload.label !== undefined) set["fallbackText"] = payload.label;
          const rows = yield* database.update(UnitExternalLink).set(set).where(eq(UnitExternalLink.id, params.id)).returning();
          if (!rows[0]) return yield* new ExternalLinkNotFound();
          return extLinkToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      .handle("deleteExternalLink", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const deleted = yield* database.delete(UnitExternalLink).where(eq(UnitExternalLink.id, params.id)).returning();
          if (deleted.length === 0) return yield* new ExternalLinkNotFound();
        }).pipe(Effect.orDie),
      );
  }),
);
