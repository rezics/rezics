import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { type SQL, and, asc, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  SubjectAttribution,
  Unit,
  UnitExternalLink,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  EntityForbidden,
  EntityListResult,
  EntityNotFound,
} from "../interfaces/entities.ts";

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function entityToDTO(
  unit: typeof Unit.$inferSelect,
  entity: typeof Entity.$inferSelect,
  translations: Array<typeof UnitTranslation.$inferSelect>,
) {
  return {
    unitId: entity.unitId,
    kind: entity.kind ?? null,
    avatar: entity.avatar ?? null,
    verified: entity.verified,
    eligibleCreditRoles: entity.eligibleCreditRoles,
    eligibleSubjectRoles: entity.eligibleSubjectRoles,
    slug: unit.slug ?? null,
    ownerUnitId: unit.userId ?? null,
    translations: translations.map((tr) => ({
      unitId: tr.unitId,
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
      description: tr.description ?? null,
      extra: tr.extra ?? null,
      sourceUnitId: tr.sourceUnitId ?? null,
      createdAt: tr.createdAt.toISOString(),
      updatedAt: tr.updatedAt.toISOString(),
    })),
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

function creditAttributionToDTO(
  row: typeof CreditAttribution.$inferSelect,
  entityUnit: typeof Unit.$inferSelect | undefined,
  entityRow: typeof Entity.$inferSelect | undefined,
  entityTranslations: Array<typeof UnitTranslation.$inferSelect>,
) {
  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role,
    position: row.position,
    entity: entityUnit
      ? {
          unitId: entityUnit.id,
          kind: entityRow?.kind ?? null,
          avatar: entityRow?.avatar ?? null,
          verified: entityRow?.verified ?? false,
          eligibleCreditRoles: entityRow?.eligibleCreditRoles ?? [],
          eligibleSubjectRoles: entityRow?.eligibleSubjectRoles ?? [],
          slug: entityUnit.slug ?? null,
          ownerUnitId: entityUnit.userId ?? null,
          translations: entityTranslations.map((tr) => ({
            unitId: tr.unitId,
            language: tr.language,
            title: tr.title ?? null,
            subtitle: tr.subtitle ?? null,
            summary: tr.summary ?? null,
            description: tr.description ?? null,
            extra: tr.extra ?? null,
            sourceUnitId: tr.sourceUnitId ?? null,
            createdAt: tr.createdAt.toISOString(),
            updatedAt: tr.updatedAt.toISOString(),
          })),
          createdAt: entityUnit.createdAt.toISOString(),
          updatedAt: entityUnit.updatedAt.toISOString(),
        }
      : null,
  };
}

function subjectAttributionToDTO(
  row: typeof SubjectAttribution.$inferSelect,
  entityUnit: typeof Unit.$inferSelect | undefined,
  entityRow: typeof Entity.$inferSelect | undefined,
  entityTranslations: Array<typeof UnitTranslation.$inferSelect>,
) {
  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role,
    position: row.position,
    weight: row.weight ?? null,
    entity: entityUnit
      ? {
          unitId: entityUnit.id,
          kind: entityRow?.kind ?? null,
          avatar: entityRow?.avatar ?? null,
          verified: entityRow?.verified ?? false,
          eligibleCreditRoles: entityRow?.eligibleCreditRoles ?? [],
          eligibleSubjectRoles: entityRow?.eligibleSubjectRoles ?? [],
          slug: entityUnit.slug ?? null,
          ownerUnitId: entityUnit.userId ?? null,
          translations: entityTranslations.map((tr) => ({
            unitId: tr.unitId,
            language: tr.language,
            title: tr.title ?? null,
            subtitle: tr.subtitle ?? null,
            summary: tr.summary ?? null,
            description: tr.description ?? null,
            extra: tr.extra ?? null,
            sourceUnitId: tr.sourceUnitId ?? null,
            createdAt: tr.createdAt.toISOString(),
            updatedAt: tr.updatedAt.toISOString(),
          })),
          createdAt: entityUnit.createdAt.toISOString(),
          updatedAt: entityUnit.updatedAt.toISOString(),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------

/** Parse comma-separated IDs; returns null when input is empty/blank. / 解析逗号分隔的 ID；空白时返回 null */
function parseIdsCsv(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

// ---------------------------------------------------------------------------
// EntitiesHandlers — /entity CRUD
// EntitiesHandlers — /entity 增删改查
// ---------------------------------------------------------------------------

export const EntitiesHandlers = HttpApiBuilder.group(
  Api,
  "entities",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: hydrate entity by unitId / 共享辅助：通过 unitId 获取 entity 全量数据
    const hydrateEntity = (unitId: string) =>
      Effect.gen(function* () {
        const units = yield* database.select().from(Unit).where(eq(Unit.id, unitId));
        if (!units[0]) return yield* new EntityNotFound();
        const entities = yield* database.select().from(Entity).where(eq(Entity.unitId, unitId));
        if (!entities[0]) return yield* new EntityNotFound();
        const translations = yield* 
          database.select().from(UnitTranslation).where(eq(UnitTranslation.unitId, unitId));
        return entityToDTO(units[0], entities[0], translations);
      });

    return handlers
      // ---- GET /entity/by-slug/:slug / 通过 slug 查找实体 ----
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          // Entity slugScope is a well-known scope; find entity Unit by slug
          // 实体的 slugScope 是固定作用域；通过 slug 查找实体 Unit
          const unitRows = yield* 
            database
              .select({ id: Unit.id, type: Unit.type })
              .from(Unit)
              .innerJoin(Entity, eq(Entity.unitId, Unit.id))
              .where(eq(Unit.slug, params.slug))
              .limit(1);
          if (!unitRows[0]) return yield* new EntityNotFound();
          return yield* hydrateEntity(unitRows[0].id);
        }),
      )

      // ---- GET /entity/ — list entities / 列出实体 ----
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const conditions: SQL[] = [];

          if (query.kind) conditions.push(eq(Entity.kind, query.kind));
          if (query.verified !== undefined) {
            conditions.push(eq(Entity.verified, query.verified === "true"));
          }
          if (query.ownerUnitId) conditions.push(eq(Unit.userId, query.ownerUnitId));
          if (query.q?.trim()) {
            conditions.push(
              sql`EXISTS (
                SELECT 1 FROM "UnitTranslation" tr
                WHERE tr."unitId" = ${Entity.unitId}
                  AND tr."title" ILIKE ${`%${query.q.trim()}%`}
              )`,
            );
          }
          const idList = parseIdsCsv(query.ids);
          if (idList && idList.length > 0) {
            conditions.push(inArray(Entity.unitId, idList));
          }

          const where = conditions.length > 0 ? and(...conditions) : undefined;

          const rows = yield* 
            database
              .select({ unitId: Entity.unitId })
              .from(Entity)
              .innerJoin(Unit, eq(Entity.unitId, Unit.id))
              .where(where)
              .orderBy(desc(Unit.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

          const agg = yield* 
            database
              .select({ total: count() })
              .from(Entity)
              .innerJoin(Unit, eq(Entity.unitId, Unit.id))
              .where(where);

          const entityIds = rows.map((r) => r.unitId);
          const entities =
            entityIds.length > 0
              ? yield* database.select().from(Entity).where(inArray(Entity.unitId, entityIds))
              : [];
          const units =
            entityIds.length > 0
              ? yield* database.select().from(Unit).where(inArray(Unit.id, entityIds))
              : [];
          const translations =
            entityIds.length > 0
              ? yield* database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, entityIds))
              : [];

          const entityMap = new Map(entities.map((e) => [e.unitId, e]));
          const unitMap = new Map(units.map((u) => [u.id, u]));
          const transMap = new Map<string, Array<typeof UnitTranslation.$inferSelect>>();
          for (const tr of translations) {
            const list = transMap.get(tr.unitId) ?? [];
            list.push(tr);
            transMap.set(tr.unitId, list);
          }

          const items = entityIds.map((id) => {
            const unit = unitMap.get(id)!;
            const entity = entityMap.get(id)!;
            return entityToDTO(unit, entity, transMap.get(id) ?? []);
          });

          return new EntityListResult({ entities: items, total: agg[0]?.total ?? 0 });
        }),
      )

      // ---- GET /entity/:unitId — look up by unitId / 通过 unitId 查找实体 ----
      .handle("getById", ({ params }) => hydrateEntity(params.unitId))

      // ---- POST /entity/ — create entity / 创建实体 ----
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const input = payload as Record<string, any>;
          const language = (input["translations"]?.[0]?.language as string) ?? "en";

          const unitRows = yield* 
            database
              .insert(Unit)
              .values({
                type: "ENTITY",
                slug: (input["slug"] as string) ?? undefined,
                slugScope: user.id,
                status: "PUBLISHED",
                visibility: "PUBLIC",
                userId: user.id,
                defaultLanguage: language,
              })
              .returning();
          const unit = unitRows[0]!;

          yield* 
            database.insert(Entity).values({
              unitId: unit.id,
              kind: (input["kind"] as string) ?? undefined,
              avatar: (input["avatar"] as string) ?? undefined,
              verified: (input["verified"] as boolean) ?? false,
              eligibleCreditRoles: (input["eligibleCreditRoles"] as string[]) ?? [],
              eligibleSubjectRoles: (input["eligibleSubjectRoles"] as string[]) ?? [],
            });

          // Insert translations / 插入翻译
          const translations = (input["translations"] ?? []) as Array<Record<string, any>>;
          for (const tr of translations) {
            yield* 
              database.insert(UnitTranslation).values({
                unitId: unit.id,
                language: tr["language"] as string,
                title: (tr["title"] as string) ?? undefined,
                subtitle: (tr["subtitle"] as string) ?? undefined,
                summary: (tr["summary"] as string) ?? undefined,
                description: tr["description"] ?? undefined,
              });
          }

          return yield* hydrateEntity(unit.id);
        }),
      )

      // ---- PATCH /entity/:unitId — update entity / 更新实体 ----
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const units = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!units[0]) return yield* new EntityNotFound();

          const input = payload as Record<string, any>;

          // Update Entity fields / 更新 Entity 字段
          const entityUpdate: Partial<typeof Entity.$inferInsert> = {};
          if (input["kind"] !== undefined) entityUpdate.kind = input["kind"] ?? null;
          if (input["avatar"] !== undefined) entityUpdate.avatar = input["avatar"] ?? null;
          if (input["verified"] !== undefined) entityUpdate.verified = input["verified"];
          if (input["eligibleCreditRoles"] !== undefined) {
            entityUpdate.eligibleCreditRoles = input["eligibleCreditRoles"];
          }
          if (input["eligibleSubjectRoles"] !== undefined) {
            entityUpdate.eligibleSubjectRoles = input["eligibleSubjectRoles"];
          }
          if (Object.keys(entityUpdate).length > 0) {
            yield* database.update(Entity).set(entityUpdate).where(eq(Entity.unitId, params.unitId));
          }

          // Update Unit slug / 更新 Unit slug
          if (input["slug"] !== undefined) {
            yield* 
              database
                .update(Unit)
                .set({ slug: input["slug"] ?? null, updatedAt: new Date() })
                .where(eq(Unit.id, params.unitId));
          }

          // Update/insert translations / 更新/插入翻译
          const translations = (input["translations"] ?? []) as Array<Record<string, any>>;
          for (const tr of translations) {
            yield* 
              database
                .insert(UnitTranslation)
                .values({
                  unitId: params.unitId,
                  language: tr["language"] as string,
                  title: (tr["title"] as string) ?? undefined,
                  subtitle: (tr["subtitle"] as string) ?? undefined,
                  summary: (tr["summary"] as string) ?? undefined,
                  description: tr["description"] ?? undefined,
                })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: {
                    title: (tr["title"] as string) ?? undefined,
                    subtitle: (tr["subtitle"] as string) ?? undefined,
                    summary: (tr["summary"] as string) ?? undefined,
                    description: tr["description"] ?? undefined,
                    updatedAt: new Date(),
                  },
                });
          }

          yield* database.update(Unit).set({ updatedAt: new Date() }).where(eq(Unit.id, params.unitId));
          return yield* hydrateEntity(params.unitId);
        }),
      )

      // ---- DELETE /entity/:unitId — delete entity / 删除实体 ----
      .handle("remove", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          // Admin-only check: entity deletion requires ownership or admin
          // 管理员检查：删除实体要求所有权或管理员身份
          const units = yield* database.select().from(Unit).where(eq(Unit.id, params.unitId));
          if (!units[0]) return yield* new EntityForbidden();
          if (units[0].userId !== user.id) return yield* new EntityForbidden();
          yield* database.delete(Unit).where(eq(Unit.id, params.unitId));
          return { message: "Entity deleted successfully" };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// EntityAttributionHandlers — /unit/:unitId/entity-attributions/batch
// EntityAttributionHandlers — 实体归属批量操作
// ---------------------------------------------------------------------------

export const EntityAttributionHandlers = HttpApiBuilder.group(
  Api,
  "entityAttribution",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers.handle("batchUpdate", ({ params, payload }) =>
      Effect.gen(function* () {
        yield* CurrentUser;
        const input = payload as Record<string, any>;
        const ops = (input["ops"] ?? []) as Array<Record<string, any>>;
        const unitId = params.unitId;

        for (const op of ops) {
          const role = op["role"] as string;
          const entries = (op["entries"] ?? []) as Array<Record<string, any>>;

          if (op["op"] === "setCredits") {
            // Remove credits for this role not in new set / 移除此角色中不在新集合中的创作归属
            const keepEntityIds = entries.map((e) => e["entityId"] as string);
            yield* 
              database
                .delete(CreditAttribution)
                .where(
                  and(
                    eq(CreditAttribution.unitId, unitId),
                    eq(CreditAttribution.role, role),
                    keepEntityIds.length > 0
                      ? notInArray(CreditAttribution.entityId, keepEntityIds)
                      : undefined,
                  ),
                );
            // Upsert remaining / 更新或插入剩余条目
            for (const entry of entries) {
              const position = (entry["position"] as string) ?? "V";
              yield* 
                database
                  .insert(CreditAttribution)
                  .values({
                    unitId,
                    entityId: entry["entityId"] as string,
                    role,
                    position,
                  })
                  .onConflictDoUpdate({
                    target: [CreditAttribution.unitId, CreditAttribution.entityId, CreditAttribution.role],
                    set: { position },
                  });
            }
          } else {
            // setSubjects / 设置主题归属
            const keepEntityIds = entries.map((e) => e["entityId"] as string);
            yield* 
              database
                .delete(SubjectAttribution)
                .where(
                  and(
                    eq(SubjectAttribution.unitId, unitId),
                    eq(SubjectAttribution.role, role),
                    keepEntityIds.length > 0
                      ? notInArray(SubjectAttribution.entityId, keepEntityIds)
                      : undefined,
                  ),
                );
            for (const entry of entries) {
              const position = (entry["position"] as string) ?? "V";
              const weight = (entry["weight"] as number) ?? null;
              yield* 
                database
                  .insert(SubjectAttribution)
                  .values({
                    unitId,
                    entityId: entry["entityId"] as string,
                    role,
                    position,
                    weight,
                  })
                  .onConflictDoUpdate({
                    target: [SubjectAttribution.unitId, SubjectAttribution.entityId, SubjectAttribution.role],
                    set: { position, weight },
                  });
            }
          }
        }

        // Load final state and return / 加载最终状态并返回
        const credits = yield* 
          database
            .select()
            .from(CreditAttribution)
            .where(eq(CreditAttribution.unitId, unitId))
            .orderBy(asc(CreditAttribution.role), asc(CreditAttribution.position));
        const subjects = yield* 
          database
            .select()
            .from(SubjectAttribution)
            .where(eq(SubjectAttribution.unitId, unitId))
            .orderBy(asc(SubjectAttribution.role), asc(SubjectAttribution.position));

        return {
          unitId,
          changed: true,
          credits: credits.map((c) => ({
            unitId: c.unitId,
            entityId: c.entityId,
            role: c.role,
            position: c.position,
          })),
          subjects: subjects.map((s) => ({
            unitId: s.unitId,
            entityId: s.entityId,
            role: s.role,
            position: s.position,
            weight: s.weight ?? null,
          })),
        };
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// CreditAttributionHandlers — /credit-attribution CRUD
// CreditAttributionHandlers — 创作归属增删改查
// ---------------------------------------------------------------------------

export const CreditAttributionHandlers = HttpApiBuilder.group(
  Api,
  "creditAttribution",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Hydrate credit attribution rows with entity data / 用实体数据注水创作归属行
    const hydrateCreditRows = (rows: Array<typeof CreditAttribution.$inferSelect>) =>
      Effect.gen(function* () {
        if (rows.length === 0) return [];
        const entityIds = [...new Set(rows.map((r) => r.entityId))];

        const entityUnits = yield* database.select().from(Unit).where(inArray(Unit.id, entityIds));
        const entities = yield* database.select().from(Entity).where(inArray(Entity.unitId, entityIds));
        const translations = yield* 
          database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, entityIds));

        const unitMap = new Map(entityUnits.map((u) => [u.id, u]));
        const entityMap = new Map(entities.map((e) => [e.unitId, e]));
        const transMap = new Map<string, Array<typeof UnitTranslation.$inferSelect>>();
        for (const tr of translations) {
          const list = transMap.get(tr.unitId) ?? [];
          list.push(tr);
          transMap.set(tr.unitId, list);
        }

        return rows.map((row) =>
          creditAttributionToDTO(
            row,
            unitMap.get(row.entityId),
            entityMap.get(row.entityId),
            transMap.get(row.entityId) ?? [],
          ),
        );
      });

    return handlers
      // ---- POST /credit-attribution/ — link / 创建关联 ----
      .handle("link", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const input = payload as Record<string, any>;
          const unitId = input["unitId"] as string;
          const entityId = input["entityId"] as string;
          const role = input["role"] as string;
          const position = (input["position"] as string) ?? "V";

          const [row] = yield* 
            database
              .insert(CreditAttribution)
              .values({ unitId, entityId, role, position })
              .returning();

          const hydrated = yield* hydrateCreditRows([row!]);
          return hydrated[0]!;
        }),
      )

      // ---- GET /credit-attribution/by-unit/:unitId — list / 列出 ----
      .handle("listByUnit", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* 
            database
              .select()
              .from(CreditAttribution)
              .where(eq(CreditAttribution.unitId, params.unitId))
              .orderBy(
                asc(CreditAttribution.role),
                asc(CreditAttribution.position),
                asc(CreditAttribution.entityId),
              );
          return yield* hydrateCreditRows(rows);
        }),
      )

      // ---- POST /credit-attribution/evidence — create evidence / 创建证据 ----
      .handle("createEvidence", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const input = payload as Record<string, any>;
          const unitId = input["unitId"] as string;
          const entityId = input["entityId"] as string;
          const role = input["role"] as string;
          const sourceExternalLinkId = input["sourceExternalLinkId"] as string;

          // Verify CreditAttribution exists / 验证创作归属存在
          const existing = yield* 
            database
              .select()
              .from(CreditAttribution)
              .where(
                and(
                  eq(CreditAttribution.unitId, unitId),
                  eq(CreditAttribution.entityId, entityId),
                  eq(CreditAttribution.role, role),
                ),
              )
              .limit(1);
          if (!existing[0]) return yield* new EntityForbidden();

          // Verify source external link exists and belongs to the unit / 验证来源外部链接存在且属于该 unit
          const linkRows = yield* 
            database
              .select({ id: UnitExternalLink.id, unitId: UnitExternalLink.unitId })
              .from(UnitExternalLink)
              .where(eq(UnitExternalLink.id, sourceExternalLinkId))
              .limit(1);
          if (!linkRows[0]) return yield* new EntityForbidden();

          yield* 
            database.insert(CreditAttributionEvidence).values({
              unitId,
              entityId,
              role,
              sourceExternalLinkId,
              claimPath: (input["claimPath"] as string) ?? undefined,
              observedUrl: (input["observedUrl"] as string) ?? undefined,
              observedAt: input["observedAt"] ? new Date(input["observedAt"] as string) : new Date(),
              confidence: (input["confidence"] as number) ?? undefined,
            });

          const hydrated = yield* hydrateCreditRows([existing[0]]);
          return hydrated[0]!;
        }),
      )

      // ---- DELETE /credit-attribution/:unitId/:entityId/:role — unlink / 解除关联 ----
      .handle("unlink", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* 
            database
              .delete(CreditAttribution)
              .where(
                and(
                  eq(CreditAttribution.unitId, params.unitId),
                  eq(CreditAttribution.entityId, params.entityId),
                  eq(CreditAttribution.role, params.role),
                ),
              );
          return { message: "Credit attribution unlinked" };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// SubjectAttributionHandlers — /subject-attribution CRUD
// SubjectAttributionHandlers — 主题归属增删改查
// ---------------------------------------------------------------------------

export const SubjectAttributionHandlers = HttpApiBuilder.group(
  Api,
  "subjectAttribution",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Hydrate subject attribution rows with entity data / 用实体数据注水主题归属行
    const hydrateSubjectRows = (rows: Array<typeof SubjectAttribution.$inferSelect>) =>
      Effect.gen(function* () {
        if (rows.length === 0) return [];
        const entityIds = [...new Set(rows.map((r) => r.entityId))];

        const entityUnits = yield* database.select().from(Unit).where(inArray(Unit.id, entityIds));
        const entities = yield* database.select().from(Entity).where(inArray(Entity.unitId, entityIds));
        const translations = yield* 
          database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, entityIds));

        const unitMap = new Map(entityUnits.map((u) => [u.id, u]));
        const entityMap = new Map(entities.map((e) => [e.unitId, e]));
        const transMap = new Map<string, Array<typeof UnitTranslation.$inferSelect>>();
        for (const tr of translations) {
          const list = transMap.get(tr.unitId) ?? [];
          list.push(tr);
          transMap.set(tr.unitId, list);
        }

        return rows.map((row) =>
          subjectAttributionToDTO(
            row,
            unitMap.get(row.entityId),
            entityMap.get(row.entityId),
            transMap.get(row.entityId) ?? [],
          ),
        );
      });

    return handlers
      // ---- POST /subject-attribution/ — link / 创建关联 ----
      .handle("link", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const input = payload as Record<string, any>;
          const unitId = input["unitId"] as string;
          const entityId = input["entityId"] as string;
          const role = input["role"] as string;
          const position = (input["position"] as string) ?? "V";
          const weight = (input["weight"] as number) ?? null;

          const [row] = yield* 
            database
              .insert(SubjectAttribution)
              .values({ unitId, entityId, role, position, weight })
              .returning();

          const hydrated = yield* hydrateSubjectRows([row!]);
          return hydrated[0]!;
        }),
      )

      // ---- GET /subject-attribution/by-unit/:unitId — list by unit / 按 unit 列出 ----
      .handle("listByUnit", ({ params, query }) =>
        Effect.gen(function* () {
          const conditions = [eq(SubjectAttribution.unitId, params.unitId)];
          if (query.role) conditions.push(eq(SubjectAttribution.role, query.role));

          const rows = yield* 
            database
              .select()
              .from(SubjectAttribution)
              .where(and(...conditions))
              .orderBy(
                asc(SubjectAttribution.role),
                asc(SubjectAttribution.position),
                asc(SubjectAttribution.entityId),
              );
          return yield* hydrateSubjectRows(rows);
        }),
      )

      // ---- GET /subject-attribution/by-subject/:entityId — list by subject / 按主题列出 ----
      .handle("listBySubject", ({ params, query }) =>
        Effect.gen(function* () {
          const conditions = [eq(SubjectAttribution.entityId, params.entityId)];
          if (query.role) conditions.push(eq(SubjectAttribution.role, query.role));

          const rows = yield* 
            database
              .select({
                unitId: SubjectAttribution.unitId,
                entityId: SubjectAttribution.entityId,
                role: SubjectAttribution.role,
                position: SubjectAttribution.position,
                weight: SubjectAttribution.weight,
              })
              .from(SubjectAttribution)
              .where(and(...conditions))
              .orderBy(
                asc(SubjectAttribution.role),
                asc(SubjectAttribution.position),
                asc(SubjectAttribution.unitId),
              );
          return yield* hydrateSubjectRows(rows);
        }),
      )

      // ---- DELETE /subject-attribution/:unitId/:entityId/:role — unlink / 解除关联 ----
      .handle("unlink", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* 
            database
              .delete(SubjectAttribution)
              .where(
                and(
                  eq(SubjectAttribution.unitId, params.unitId),
                  eq(SubjectAttribution.entityId, params.entityId),
                  eq(SubjectAttribution.role, params.role),
                ),
              );
          return { message: "Subject attribution unlinked" };
        }),
      );
  }),
);
