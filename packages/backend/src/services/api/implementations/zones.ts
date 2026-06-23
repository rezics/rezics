import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, desc, eq, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  RealmMember as RealmMemberTable,
  Unit,
  UnitTranslation,
  Zone as ZoneTable,
  ZonePage as ZonePageTable,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import { ZoneForbidden, ZoneListResult, ZoneNotFound } from "../interfaces/zones.ts";

// ---------------------------------------------------------------------------
// Helpers
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * Project a Zone row + Unit row + first translation into a plain DTO object.
 * 将 Zone 行 + Unit 行 + 第一条翻译投射为普通 DTO 对象。
 */
function zoneToDTO(
  unit: typeof Unit.$inferSelect,
  zone: typeof ZoneTable.$inferSelect,
  title: string | null,
) {
  return {
    unitId: unit.id,
    slug: unit.slug ?? "",
    name: title ?? unit.slug ?? unit.id,
    ownerRealmUnitId: zone.ownerRealmUnitId,
    boundary: zone.boundary,
    nav: zone.nav,
    theme: zone.theme,
    homePageId: zone.homePageId,
    startsAt: zone.startsAt?.toISOString() ?? null,
    endsAt: zone.endsAt?.toISOString() ?? null,
    status: unit.status,
    visibility: unit.visibility,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
  };
}

function pageToDTO(page: typeof ZonePageTable.$inferSelect) {
  return {
    id: page.id,
    zoneUnitId: page.zoneUnitId,
    slug: page.slug,
    config: page.config,
    position: page.position,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// 处理器
// ---------------------------------------------------------------------------

export const ZonesHandlers = HttpApiBuilder.group(
  Api,
  "zones",
  Effect.fn(function* (handlers) {
    const db = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a zone Unit + Zone row + first translation title
    // 共享辅助函数: 获取 zone Unit + Zone 行 + 第一条翻译标题
    const fetchZoneByUnitId = (unitId: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          db
            .select()
            .from(ZoneTable)
            .innerJoin(Unit, eq(ZoneTable.unitId, Unit.id))
            .where(and(eq(ZoneTable.unitId, unitId), eq(Unit.type, "ZONE")))
            .limit(1),
        );
        if (!rows[0]) return null;
        const trans = yield* Effect.orDie(
          db
            .select()
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, unitId))
            .limit(1),
        );
        return {
          unit: rows[0].Unit,
          zone: rows[0].Zone,
          title: (trans[0]?.title ?? null) satisfies string | null,
        };
      });

    // Shared helper: fetch zone by slug
    // 共享辅助函数: 按 slug 获取 zone
    const fetchZoneBySlug = (slug: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          db
            .select()
            .from(Unit)
            .innerJoin(ZoneTable, eq(ZoneTable.unitId, Unit.id))
            .where(and(eq(Unit.slug, slug), eq(Unit.type, "ZONE")))
            .limit(1),
        );
        if (!rows[0]) return null;
        const trans = yield* Effect.orDie(
          db
            .select()
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, rows[0].Unit.id))
            .limit(1),
        );
        return {
          unit: rows[0].Unit,
          zone: rows[0].Zone,
          title: (trans[0]?.title ?? null) satisfies string | null,
        };
      });

    // Shared helper: verify the current user has owner/admin role in the zone's owning realm.
    // 共享辅助函数: 验证当前用户在 zone 所属 realm 中拥有 owner/admin 角色。
    const requireZoneAdmin = (ownerRealmUnitId: string, userId: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          db
            .select()
            .from(RealmMemberTable)
            .where(
              and(
                eq(RealmMemberTable.realmUnitId, ownerRealmUnitId),
                eq(RealmMemberTable.userId, userId),
                eq(RealmMemberTable.state, "ACTIVE"),
              ),
            )
            .limit(1),
        );
        if (!rows[0] || (rows[0].roleKey !== "owner" && rows[0].roleKey !== "admin")) {
          return yield* new ZoneForbidden();
        }
        return rows[0];
      });

    // Shared helper: list zones with translation, paginated
    // 共享辅助函数: 带翻译的分页 zone 列表
    const listZonesWithTranslation = (opts: {
      limit: number;
      offset: number;
      conditions?: ReturnType<typeof eq>[];
    }) =>
      Effect.gen(function* () {
        const baseConditions = [eq(Unit.type, "ZONE")];
        const where = opts.conditions ? and(...baseConditions, ...opts.conditions) : and(...baseConditions);
        const rows = yield* Effect.orDie(
          db
            .select({
              Unit,
              Zone: ZoneTable,
              title: UnitTranslation.title,
            })
            .from(ZoneTable)
            .innerJoin(Unit, eq(ZoneTable.unitId, Unit.id))
            .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(opts.limit)
            .offset(opts.offset),
        );
        // Deduplicate: leftJoin on UnitTranslation may produce multiple rows per zone (one per language).
        // 去重: leftJoin UnitTranslation 可能每个 zone 产生多行（每种语言一行）。
        const seen = new Set<string>();
        const deduped: typeof rows = [];
        for (const row of rows) {
          if (!seen.has(row.Unit.id)) {
            seen.add(row.Unit.id);
            deduped.push(row);
          }
        }
        return deduped;
      });

    // Count total zones matching conditions
    // 计算匹配条件的 zone 总数
    const countZones = (conditions?: ReturnType<typeof eq>[]) =>
      Effect.gen(function* () {
        const baseConditions = [eq(Unit.type, "ZONE")];
        const where = conditions ? and(...baseConditions, ...conditions) : and(...baseConditions);
        const rows = yield* Effect.orDie(
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(ZoneTable)
            .innerJoin(Unit, eq(ZoneTable.unitId, Unit.id))
            .where(where),
        );
        return rows[0]?.count ?? 0;
      });

    return handlers
      // ── getMyZones — list zones the current user created ───────────
      // 获取当前用户创建的 zone 列表
      .handle("getMyZones", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const conditions = [eq(Unit.userId, user.id)];
          const [deduped, total] = yield* Effect.all([
            listZonesWithTranslation({ limit: lim(query.limit), offset: query.start ?? 0, conditions }),
            countZones(conditions),
          ]);
          return new ZoneListResult({
            zones: deduped.map((r) => zoneToDTO(r.Unit, r.Zone, (r.title ?? null) satisfies string | null)),
            total,
          });
        }),
      )

      // ── getByUser — list zones for a specific user ────────────────
      // 获取指定用户的 zone 列表
      .handle("getByUser", ({ params, query }) =>
        Effect.gen(function* () {
          const conditions = [eq(Unit.userId, params.userId)];
          const [deduped, total] = yield* Effect.all([
            listZonesWithTranslation({ limit: lim(query.limit), offset: query.start ?? 0, conditions }),
            countZones(conditions),
          ]);
          return new ZoneListResult({
            zones: deduped.map((r) => zoneToDTO(r.Unit, r.Zone, (r.title ?? null) satisfies string | null)),
            total,
          });
        }),
      )

      // ── getBySlug — find zone by slug ─────────────────────────────
      // 按 slug 查找 zone
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          const found = yield* fetchZoneBySlug(params.slug);
          if (!found) return yield* new ZoneNotFound();
          return zoneToDTO(found.unit, found.zone, found.title);
        }),
      )

      // ── getPortal — zone portal page data ─────────────────────────
      // 专区入口页数据
      .handle("getPortal", ({ params }) =>
        Effect.gen(function* () {
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          const pages = yield* Effect.orDie(
            db
              .select()
              .from(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.slug, params.pageSlug)))
              .limit(1),
          );
          if (!pages[0]) return yield* new ZoneNotFound();
          return {
            zone: zoneToDTO(found.unit, found.zone, found.title),
            page: pageToDTO(pages[0]),
          };
        }),
      )

      // ── getSectionData — zone section data ────────────────────────
      // 专区栏目数据
      .handle("getSectionData", ({ params }) =>
        Effect.gen(function* () {
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          const pages = yield* Effect.orDie(
            db
              .select()
              .from(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId)))
              .limit(1),
          );
          if (!pages[0]) return yield* new ZoneNotFound();
          // Return section reference; section content resolution is delegated to the frontend.
          // 返回栏目引用；栏目内容解析委托给前端。
          return {
            zone: zoneToDTO(found.unit, found.zone, found.title),
            page: pageToDTO(pages[0]),
            sectionId: params.sectionId,
          };
        }),
      )

      // ── create — create a new zone ────────────────────────────────
      // 创建专区
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Payload: { slug, name, ownerRealmUnitId, boundary?, nav?, theme?, description? }
          // Verify user is admin/owner in the owning realm
          // 验证用户在所属 realm 中是 admin/owner
          yield* requireZoneAdmin(payload.ownerRealmUnitId, user.id);

          // Create the Unit row with type ZONE
          // 创建 type=ZONE 的 Unit 行
          const units = yield* Effect.orDie(
            db
              .insert(Unit)
              .values({
                type: "ZONE",
                userId: user.id,
                slug: payload.slug,
                slugScope: payload.ownerRealmUnitId,
                defaultLanguage: "en",
                status: "PUBLISHED",
                visibility: "PUBLIC",
              })
              .returning(),
          );
          const unit = units[0]!;

          // Create UnitTranslation for the zone name
          // 创建 UnitTranslation 存储 zone 名称
          yield* Effect.orDie(
            db.insert(UnitTranslation).values({
              unitId: unit.id,
              language: "en",
              title: payload.name ?? payload.slug,
              summary: payload.description ?? null,
            }),
          );

          // Create the Zone row
          // 创建 Zone 行
          const zones = yield* Effect.orDie(
            db
              .insert(ZoneTable)
              .values({
                unitId: unit.id,
                ownerRealmUnitId: payload.ownerRealmUnitId,
                boundary: payload.boundary ?? {},
                nav: payload.nav ?? { items: [] },
                theme: payload.theme ?? {},
              })
              .returning(),
          );

          return zoneToDTO(unit, zones[0]!, payload.name ?? payload.slug);
        }),
      )

      // ── update — update zone metadata ─────────────────────────────
      // 更新专区元数据
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          // Update Unit fields if provided
          // 如果提供了 Unit 字段则更新
          if (payload.slug || payload.status || payload.visibility) {
            const unitUpdates: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.slug) unitUpdates["slug"] = payload.slug;
            if (payload.status) unitUpdates["status"] = payload.status;
            if (payload.visibility) unitUpdates["visibility"] = payload.visibility;
            yield* Effect.orDie(db.update(Unit).set(unitUpdates).where(eq(Unit.id, params.unitId)));
          }

          // Update translation if name/description provided
          // 如果提供了 name/description 则更新翻译
          if (payload.name || payload.description !== undefined) {
            const transUpdates: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.name) transUpdates["title"] = payload.name;
            if (payload.description !== undefined) transUpdates["summary"] = payload.description;
            yield* Effect.orDie(
              db.update(UnitTranslation).set(transUpdates).where(eq(UnitTranslation.unitId, params.unitId)),
            );
          }

          // Update Zone-specific fields if provided
          // 如果提供了 Zone 专有字段则更新
          if (payload.homePageId !== undefined || payload.startsAt !== undefined || payload.endsAt !== undefined) {
            const zoneUpdates: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.homePageId !== undefined) zoneUpdates["homePageId"] = payload.homePageId;
            if (payload.startsAt !== undefined) zoneUpdates["startsAt"] = payload.startsAt ? new Date(payload.startsAt) : null;
            if (payload.endsAt !== undefined) zoneUpdates["endsAt"] = payload.endsAt ? new Date(payload.endsAt) : null;
            yield* Effect.orDie(db.update(ZoneTable).set(zoneUpdates).where(eq(ZoneTable.unitId, params.unitId)));
          }

          const refreshed = yield* fetchZoneByUnitId(params.unitId);
          return zoneToDTO(refreshed!.unit, refreshed!.zone, refreshed!.title);
        }),
      )

      // ── updateBoundary — update zone boundary config ──────────────
      // 更新专区边界配置
      .handle("updateBoundary", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          yield* Effect.orDie(
            db
              .update(ZoneTable)
              .set({ boundary: payload, updatedAt: new Date() })
              .where(eq(ZoneTable.unitId, params.unitId)),
          );

          const refreshed = yield* fetchZoneByUnitId(params.unitId);
          return zoneToDTO(refreshed!.unit, refreshed!.zone, refreshed!.title);
        }),
      )

      // ── updateNav — update zone navigation config ─────────────────
      // 更新专区导航配置
      .handle("updateNav", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          yield* Effect.orDie(
            db
              .update(ZoneTable)
              .set({ nav: payload, updatedAt: new Date() })
              .where(eq(ZoneTable.unitId, params.unitId)),
          );

          const refreshed = yield* fetchZoneByUnitId(params.unitId);
          return zoneToDTO(refreshed!.unit, refreshed!.zone, refreshed!.title);
        }),
      )

      // ── updateTheme — update zone theme config ────────────────────
      // 更新专区主题配置
      .handle("updateTheme", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          yield* Effect.orDie(
            db
              .update(ZoneTable)
              .set({ theme: payload, updatedAt: new Date() })
              .where(eq(ZoneTable.unitId, params.unitId)),
          );

          const refreshed = yield* fetchZoneByUnitId(params.unitId);
          return zoneToDTO(refreshed!.unit, refreshed!.zone, refreshed!.title);
        }),
      )

      // ── remove — delete zone ──────────────────────────────────────
      // 删除专区
      .handle("remove", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          // Cascade: deleting the Unit cascades to Zone + ZonePage + UnitTranslation
          // 级联: 删除 Unit 会级联删除 Zone + ZonePage + UnitTranslation
          yield* Effect.orDie(db.delete(Unit).where(eq(Unit.id, params.unitId)));

          return { message: "Zone deleted" };
        }),
      )

      // ── createPage — create a zone page ───────────────────────────
      // 创建专区页面
      .handle("createPage", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          const pages = yield* Effect.orDie(
            db
              .insert(ZonePageTable)
              .values({
                zoneUnitId: params.unitId,
                slug: payload.slug,
                config: payload.config ?? { sections: [] },
                position: payload.position ?? "V",
              })
              .returning(),
          );

          return pageToDTO(pages[0]!);
        }),
      )

      // ── updatePage — update a zone page ───────────────────────────
      // 更新专区页面
      .handle("updatePage", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          const existing = yield* Effect.orDie(
            db
              .select()
              .from(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId)))
              .limit(1),
          );
          if (!existing[0]) return yield* new ZoneNotFound();

          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (payload.slug) updates["slug"] = payload.slug;
          if (payload.config !== undefined) updates["config"] = payload.config;
          if (payload.position) updates["position"] = payload.position;

          yield* Effect.orDie(
            db
              .update(ZonePageTable)
              .set(updates)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId))),
          );

          const refreshed = yield* Effect.orDie(
            db
              .select()
              .from(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId)))
              .limit(1),
          );

          return pageToDTO(refreshed[0]!);
        }),
      )

      // ── deletePage — delete a zone page ───────────────────────────
      // 删除专区页面
      .handle("deletePage", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchZoneByUnitId(params.unitId);
          if (!found) return yield* new ZoneNotFound();
          yield* requireZoneAdmin(found.zone.ownerRealmUnitId, user.id);

          const existing = yield* Effect.orDie(
            db
              .select()
              .from(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId)))
              .limit(1),
          );
          if (!existing[0]) return yield* new ZoneNotFound();

          yield* Effect.orDie(
            db
              .delete(ZonePageTable)
              .where(and(eq(ZonePageTable.zoneUnitId, params.unitId), eq(ZonePageTable.id, params.pageId))),
          );

          return { message: "Page deleted" };
        }),
      );
  }),
);
