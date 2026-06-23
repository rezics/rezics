import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, desc, eq, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  Realm as RealmTable,
  RealmMember as RealmMemberTable,
  Unit,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  Realm as RealmDTO,
  RealmAlreadyMember,
  RealmMember as RealmMemberDTO,
  RealmMemberNotFound,
  RealmNotFound,
  RealmSlugConflict,
} from "../interfaces/realms.ts";

// ---------------------------------------------------------------------------
// Mappers — convert DB rows to DTOs
// 映射函数 —— 将 DB 行转换为 DTO
// ---------------------------------------------------------------------------

function realmToDTO(
  unit: typeof Unit.$inferSelect,
  translationTitle: string | null,
) {
  return new RealmDTO({
    id: unit.id,
    slug: unit.slug ?? "",
    name: translationTitle ?? unit.slug ?? unit.id,
  });
}

function memberToDTO(row: typeof RealmMemberTable.$inferSelect) {
  return new RealmMemberDTO({
    userId: row.userId,
    realmUnitId: row.realmUnitId,
    role: row.roleKey,
  });
}

// ---------------------------------------------------------------------------
// Handlers — core realm CRUD + membership
// 处理器 —— 核心 realm CRUD + 成员管理
// ---------------------------------------------------------------------------

export const RealmsHandlers = HttpApiBuilder.group(
  Api,
  "realms",
  Effect.fn(function* (handlers) {
    const db = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a realm Unit + first translation title
    // 共享辅助函数: 获取 realm Unit + 第一个翻译标题
    const fetchRealmByUnitId = (unitId: string) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          db
            .select()
            .from(RealmTable)
            .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
            .where(and(eq(RealmTable.unitId, unitId), eq(Unit.type, "REALM")))
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
        return { unit: rows[0].Unit, realm: rows[0].Realm, title: (trans[0]?.title as string) ?? null };
      });

    // Shared helper: list realms from a pre-built set of unit IDs or a full scan
    // 共享辅助函数: 从预构建的 unit ID 集合或全表扫描列表 realms
    const listRealmsWithTranslation = (opts: { limit: number; offset: number; conditions?: ReturnType<typeof eq>[] }) =>
      Effect.gen(function* () {
        const baseConditions = [eq(Unit.type, "REALM")];
        const where = opts.conditions ? and(...baseConditions, ...opts.conditions) : and(...baseConditions);
        const rows = yield* Effect.orDie(
          db
            .select({
              Unit,
              Realm: RealmTable,
              title: UnitTranslation.title,
            })
            .from(RealmTable)
            .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
            .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(opts.limit)
            .offset(opts.offset),
        );
        // Deduplicate: leftJoin on UnitTranslation may produce multiple rows per realm (one per language).
        // Keep only the first translation row per unit.
        // 去重: leftJoin UnitTranslation 可能每个 realm 产生多行（每种语言一行）。
        // 仅保留每个 unit 的第一条翻译行。
        const seen = new Set<string>();
        const deduped: typeof rows = [];
        for (const row of rows) {
          if (!seen.has(row.Unit.id)) {
            seen.add(row.Unit.id);
            deduped.push(row);
          }
        }
        return deduped.map((r) => realmToDTO(r.Unit, (r.title as string) ?? null));
      });

    return handlers
      // ── list — paginated list of realms ────────────────────────
      // 分页获取 realm 列表
      .handle("list", ({ query }) =>
        listRealmsWithTranslation({
          limit: lim(query.limit),
          offset: query.offset ?? 0,
        }),
      )

      .handle("listByFilter", ({ payload }) =>
        listRealmsWithTranslation({
          limit: lim(payload.limit),
          offset: payload.offset ?? 0,
        }),
      )

      // ── getBySlug — find realm by slug ─────────────────────────
      // 按 slug 查找 realm
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(Unit)
              .innerJoin(RealmTable, eq(RealmTable.unitId, Unit.id))
              .where(and(eq(Unit.slug, params.slug), eq(Unit.type, "REALM")))
              .limit(1),
          );
          if (!rows[0]) return yield* new RealmNotFound();
          const trans = yield* Effect.orDie(
            db
              .select()
              .from(UnitTranslation)
              .where(eq(UnitTranslation.unitId, rows[0].Unit.id))
              .limit(1),
          );
          return realmToDTO(rows[0].Unit, (trans[0]?.title as string) ?? null);
        }),
      )

      // ── getById — find realm by unit ID ────────────────────────
      // 按 unit ID 查找 realm
      .handle("getById", ({ params }) =>
        Effect.gen(function* () {
          const found = yield* fetchRealmByUnitId(params.unitId);
          if (!found) return yield* new RealmNotFound();
          return realmToDTO(found.unit, found.title);
        }),
      )

      // ── listMine — list realms the current user belongs to ─────
      // 获取当前用户加入的 realm 列表
      .handle("listMine", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const memberships = yield* Effect.orDie(
            db
              .select({ realmUnitId: RealmMemberTable.realmUnitId })
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.userId, user.id), eq(RealmMemberTable.state, "ACTIVE"))),
          );
          if (memberships.length === 0) return [];
          const realmIds = memberships.map((m) => m.realmUnitId);
          const rows = yield* Effect.orDie(
            db
              .select({
                Unit,
                Realm: RealmTable,
                title: UnitTranslation.title,
              })
              .from(RealmTable)
              .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
              .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
              .where(and(eq(Unit.type, "REALM"), sql`${Unit.id} = ANY(${realmIds})`))
              .orderBy(desc(Unit.createdAt)),
          );
          const seen = new Set<string>();
          const deduped: typeof rows = [];
          for (const row of rows) {
            if (!seen.has(row.Unit.id)) {
              seen.add(row.Unit.id);
              deduped.push(row);
            }
          }
          return deduped.map((r) => realmToDTO(r.Unit, (r.title as string) ?? null));
        }),
      )

      // ── listByMember — list realms a specific user belongs to ──
      // 获取指定用户加入的 realm 列表
      .handle("listByMember", ({ params }) =>
        Effect.gen(function* () {
          const memberships = yield* Effect.orDie(
            db
              .select({ realmUnitId: RealmMemberTable.realmUnitId })
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.userId, params.userId), eq(RealmMemberTable.state, "ACTIVE"))),
          );
          if (memberships.length === 0) return [];
          const realmIds = memberships.map((m) => m.realmUnitId);
          const rows = yield* Effect.orDie(
            db
              .select({
                Unit,
                Realm: RealmTable,
                title: UnitTranslation.title,
              })
              .from(RealmTable)
              .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
              .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
              .where(and(eq(Unit.type, "REALM"), sql`${Unit.id} = ANY(${realmIds})`))
              .orderBy(desc(Unit.createdAt)),
          );
          const seen = new Set<string>();
          const deduped: typeof rows = [];
          for (const row of rows) {
            if (!seen.has(row.Unit.id)) {
              seen.add(row.Unit.id);
              deduped.push(row);
            }
          }
          return deduped.map((r) => realmToDTO(r.Unit, (r.title as string) ?? null));
        }),
      )

      // ── create — create a new realm ────────────────────────────
      // 创建 realm（同时创建 Unit + Realm + 自动加入创建者）
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Check slug uniqueness among realm-type units
          // 检查 slug 在 realm 类型 unit 中的唯一性
          const existing = yield* Effect.orDie(
            db
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.slug, payload.slug), eq(Unit.type, "REALM")))
              .limit(1),
          );
          if (existing.length > 0) return yield* new RealmSlugConflict();

          // Create Unit with type REALM; realms are self-scoped (slugScope = own id).
          // 创建 type=REALM 的 Unit；realm 以自身为 slug 作用域。
          const units = yield* Effect.orDie(
            db
              .insert(Unit)
              .values({
                type: "REALM",
                userId: user.id,
                slug: payload.slug,
                slugScope: user.id, // Temporarily use creator; updated below after ID is known
                defaultLanguage: "en",
                status: "PUBLISHED",
                visibility: "PUBLIC",
              })
              .returning(),
          );
          const unit = units[0]!;

          // Self-scope the slug now that we have the ID
          // 现在有了 ID，将 slug 作用域设为自身
          yield* Effect.orDie(db.update(Unit).set({ slugScope: unit.id }).where(eq(Unit.id, unit.id)));

          // Create UnitTranslation for the realm name
          // 创建 UnitTranslation 存储 realm 名称
          yield* Effect.orDie(
            db.insert(UnitTranslation).values({
              unitId: unit.id,
              language: "en",
              title: payload.name,
              summary: payload.description ?? null,
            }),
          );

          // Create the Realm row
          // 创建 Realm 行
          yield* Effect.orDie(
            db.insert(RealmTable).values({
              unitId: unit.id,
              isPublic: true,
              memberCount: 1,
            }),
          );

          // Auto-join creator as owner
          // 自动将创建者加入为 owner
          yield* Effect.orDie(
            db.insert(RealmMemberTable).values({
              realmUnitId: unit.id,
              userId: user.id,
              roleKey: "owner",
              state: "ACTIVE",
            }),
          );

          return realmToDTO({ ...unit, slugScope: unit.id }, payload.name);
        }),
      )

      // ── update — update realm ──────────────────────────────────
      // 更新 realm
      .handle("update", () => Effect.die("TODO: not implemented"))

      // ── delete — delete realm ──────────────────────────────────
      // 删除 realm
      .handle("delete", () => Effect.die("TODO: not implemented"))

      // ── getMyMembership — check current user's membership ──────
      // 检查当前用户的成员状态
      .handle("getMyMembership", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchRealmByUnitId(params.unitId);
          if (!found) return yield* new RealmNotFound();
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, user.id)))
              .limit(1),
          );
          if (!rows[0]) return null;
          return memberToDTO(rows[0]);
        }),
      )

      // ── listMembers — list members of a realm ──────────────────
      // 列出 realm 成员
      .handle("listMembers", ({ params, query }) =>
        Effect.gen(function* () {
          const found = yield* fetchRealmByUnitId(params.unitId);
          if (!found) return yield* new RealmNotFound();
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.state, "ACTIVE")))
              .orderBy(RealmMemberTable.joinedAt)
              .limit(lim(query.limit))
              .offset(query.offset ?? 0),
          );
          return rows.map(memberToDTO);
        }),
      )

      // ── addMember — join a realm ───────────────────────────────
      // 加入 realm
      .handle("addMember", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* fetchRealmByUnitId(params.unitId);
          if (!found) return yield* new RealmNotFound();

          // Determine the target userId: self-join when payload.userId is absent
          // 确定目标 userId: 当 payload.userId 缺失时为自加入
          const targetUserId = payload.userId ?? user.id;

          // Check for existing membership
          // 检查现有成员关系
          const existing = yield* Effect.orDie(
            db
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
              )
              .limit(1),
          );
          if (existing[0] && existing[0].state === "ACTIVE") return yield* new RealmAlreadyMember();

          // Determine initial state based on realm approval setting
          // 根据 realm 审核设置确定初始状态
          const initialState = found.realm.joinRequiresApproval ? "PENDING" : "ACTIVE";
          const memberCountDelta = initialState === "ACTIVE" ? 1 : 0;

          if (existing[0]) {
            // Re-activate a previously removed/banned member
            // 重新激活之前被移除/封禁的成员
            yield* Effect.orDie(
              db
                .update(RealmMemberTable)
                .set({ state: initialState, roleKey: "member", updatedAt: new Date() })
                .where(
                  and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
                ),
            );
          } else {
            yield* Effect.orDie(
              db.insert(RealmMemberTable).values({
                realmUnitId: params.unitId,
                userId: targetUserId,
                roleKey: "member",
                state: initialState,
              }),
            );
          }

          // Update member count
          // 更新成员计数
          if (memberCountDelta > 0) {
            yield* Effect.orDie(
              db
                .update(RealmTable)
                .set({ memberCount: sql`${RealmTable.memberCount} + 1` })
                .where(eq(RealmTable.unitId, params.unitId)),
            );
          }

          const rows = yield* Effect.orDie(
            db
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
              )
              .limit(1),
          );
          return memberToDTO(rows[0]!);
        }),
      )

      // ── updateMember — update member role ──────────────────────
      // 更新成员角色
      .handle("updateMember", () => Effect.die("TODO: not implemented"))

      // ── removeMember — leave/remove from realm ─────────────────
      // 离开/移除 realm
      .handle("removeMember", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const found = yield* fetchRealmByUnitId(params.unitId);
          if (!found) return yield* new RealmNotFound();

          const existing = yield* Effect.orDie(
            db
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              )
              .limit(1),
          );
          if (!existing[0] || existing[0].state !== "ACTIVE") return yield* new RealmMemberNotFound();

          yield* Effect.orDie(
            db
              .update(RealmMemberTable)
              .set({ state: "REMOVED", updatedAt: new Date() })
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              ),
          );

          // Decrement member count
          // 递减成员计数
          yield* Effect.orDie(
            db
              .update(RealmTable)
              .set({ memberCount: sql`GREATEST(${RealmTable.memberCount} - 1, 0)` })
              .where(eq(RealmTable.unitId, params.unitId)),
          );
        }),
      )

      // ── Non-core handlers: rules, mute, content, tags, dock, extra, tag-tree, pinboards ──
      // 非核心处理器: 规则、静音、内容、标签、dock、extra、标签树、钉板
      .handle("getResolvedRules", () => Effect.die("TODO: not implemented"))
      .handle("listRules", () => Effect.die("TODO: not implemented"))
      .handle("createRule", () => Effect.die("TODO: not implemented"))
      .handle("createRuleRevision", () => Effect.die("TODO: not implemented"))
      .handle("acknowledgeRules", () => Effect.die("TODO: not implemented"))
      .handle("mute", () => Effect.die("TODO: not implemented"))
      .handle("unmute", () => Effect.die("TODO: not implemented"))
      .handle("addContent", () => Effect.die("TODO: not implemented"))
      .handle("removeContent", () => Effect.die("TODO: not implemented"))
      .handle("addTags", () => Effect.die("TODO: not implemented"))
      .handle("removeTags", () => Effect.die("TODO: not implemented"))
      .handle("getDock", () => Effect.die("TODO: not implemented"))
      .handle("updateDock", () => Effect.die("TODO: not implemented"))
      .handle("setExtra", () => Effect.die("TODO: not implemented"))
      .handle("deleteExtra", () => Effect.die("TODO: not implemented"))
      .handle("getTagTree", () => Effect.die("TODO: not implemented"))
      .handle("updateTagTree", () => Effect.die("TODO: not implemented"))
      .handle("getPinboard", () => Effect.die("TODO: not implemented"))
      .handle("addPinboardEntry", () => Effect.die("TODO: not implemented"))
      .handle("reorderPinboard", () => Effect.die("TODO: not implemented"))
      .handle("deletePinboardEntry", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Tag-related handler groups (stubs preserved for API completeness)
// 标签相关处理器组（保留桩以保持 API 完整性）
// ---------------------------------------------------------------------------

export const RealmTagApplicationsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplications",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("listForUnit", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"));
  }),
);

export const RealmTagApplicationVotesHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplicationVotes",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"));
  }),
);

export const RealmTagContextsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagContexts",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("get", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("materialize", () => Effect.die("TODO: not implemented"));
  }),
);
