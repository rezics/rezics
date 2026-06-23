import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  Pinboard as PinboardTable,
  PinboardEntry as PinboardEntryTable,
  Realm as RealmTable,
  RealmMember as RealmMemberTable,
  RealmRuleItem,
  RealmRulePolicy,
  RealmRuleRevision as RealmRuleRevisionTable,
  RealmRuleAcknowledgement,
  RealmTagApplication as RealmTagApplicationTable,
  RealmTagApplicationVote as RealmTagApplicationVoteTable,
  RealmTagContext as RealmTagContextTable,
  RealmTagTree as RealmTagTreeTable,
  Unit,
  UnitRealm,
  UnitTag,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  PinboardEntry as PinboardEntryDTO,
  PinboardNotFound,
  Realm as RealmDTO,
  RealmAlreadyMember,
  RealmContentEntry as RealmContentEntryDTO,
  RealmContentNotFound,
  RealmDock as RealmDockDTO,
  RealmForbidden,
  RealmMember as RealmMemberDTO,
  RealmMemberNotFound,
  RealmNotFound,
  RealmRuleEntry as RealmRuleEntryDTO,
  RealmRuleRevision as RealmRuleRevisionDTO,
  RealmSlugConflict,
  RealmTagApplication as RealmTagApplicationDTO,
  RealmTagApplicationNotFound,
  RealmTagApplicationVote as RealmTagApplicationVoteDTO,
  RealmTagContext as RealmTagContextDTO,
  RealmTagTree as RealmTagTreeDTO,
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
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a realm Unit + first translation title
    // 共享辅助函数: 获取 realm Unit + 第一个翻译标题
    const fetchRealmByUnitId = (unitId: string) =>
      Effect.gen(function* () {
        const rows = yield* 
          database
            .select()
            .from(RealmTable)
            .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
            .where(and(eq(RealmTable.unitId, unitId), eq(Unit.type, "REALM")))
            .limit(1);
        if (!rows[0]) return null;
        const trans = yield* 
          database
            .select()
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, unitId))
            .limit(1);
        return { unit: rows[0].Unit, realm: rows[0].Realm, title: trans[0]?.title ?? null };
      });

    // Shared helper: require realm exists or yield RealmNotFound
    // 共享辅助函数: 要求 realm 存在，否则 yield RealmNotFound
    const requireRealm = (unitId: string) =>
      Effect.gen(function* () {
        const found = yield* fetchRealmByUnitId(unitId);
        if (!found) return yield* new RealmNotFound();
        return found;
      });

    // Shared helper: require caller is owner/moderator of the realm
    // 共享辅助函数: 要求调用者是 realm 的 owner/moderator
    const requireRealmAdmin = (realmUnitId: string, userId: string) =>
      Effect.gen(function* () {
        const membership = yield* 
          database
            .select()
            .from(RealmMemberTable)
            .where(
              and(
                eq(RealmMemberTable.realmUnitId, realmUnitId),
                eq(RealmMemberTable.userId, userId),
                eq(RealmMemberTable.state, "ACTIVE"),
              ),
            )
            .limit(1);
        if (!membership[0] || (membership[0].roleKey !== "owner" && membership[0].roleKey !== "moderator")) {
          return yield* new RealmForbidden();
        }
        return membership[0];
      });

    // Shared helper: list realms from a pre-built set of unit IDs or a full scan
    // 共享辅助函数: 从预构建的 unit ID 集合或全表扫描列表 realms
    const listRealmsWithTranslation = (opts: { limit: number; offset: number; conditions?: ReturnType<typeof eq>[] }) =>
      Effect.gen(function* () {
        const baseConditions = [eq(Unit.type, "REALM")];
        const where = opts.conditions ? and(...baseConditions, ...opts.conditions) : and(...baseConditions);
        const rows = yield* 
          database
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
            .offset(opts.offset);
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
        return deduped.map((r) => realmToDTO(r.Unit, r.title ?? null));
      });

    return handlers
      // ── list — paginated list of realms ────────────────────────
      // 分页获取 realm 列表
      .handle("list", ({ query }) =>
        listRealmsWithTranslation({
          limit: lim(query.limit),
          offset: query.offset ?? 0,
        }).pipe(Effect.orDie),
      )

      .handle("listByFilter", ({ payload }) =>
        listRealmsWithTranslation({
          limit: lim(payload.limit),
          offset: payload.offset ?? 0,
        }).pipe(Effect.orDie),
      )

      // ── getBySlug — find realm by slug ─────────────────────────
      // 按 slug 查找 realm
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* 
            database
              .select()
              .from(Unit)
              .innerJoin(RealmTable, eq(RealmTable.unitId, Unit.id))
              .where(and(eq(Unit.slug, params.slug), eq(Unit.type, "REALM")))
              .limit(1);
          if (!rows[0]) return yield* new RealmNotFound();
          const trans = yield* 
            database
              .select()
              .from(UnitTranslation)
              .where(eq(UnitTranslation.unitId, rows[0].Unit.id))
              .limit(1);
          return realmToDTO(rows[0].Unit, trans[0]?.title ?? null);
        }).pipe(Effect.orDie),
      )

      // ── getById — find realm by unit ID ────────────────────────
      // 按 unit ID 查找 realm
      .handle("getById", ({ params }) =>
        Effect.gen(function* () {
          const found = yield* requireRealm(params.unitId);
          return realmToDTO(found.unit, found.title);
        }).pipe(Effect.orDie),
      )

      // ── listMine — list realms the current user belongs to ─────
      // 获取当前用户加入的 realm 列表
      .handle("listMine", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const memberships = yield* 
            database
              .select({ realmUnitId: RealmMemberTable.realmUnitId })
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.userId, user.id), eq(RealmMemberTable.state, "ACTIVE")));
          if (memberships.length === 0) return [];
          const realmIds = memberships.map((m) => m.realmUnitId);
          const rows = yield* 
            database
              .select({
                Unit,
                Realm: RealmTable,
                title: UnitTranslation.title,
              })
              .from(RealmTable)
              .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
              .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
              .where(and(eq(Unit.type, "REALM"), sql`${Unit.id} = ANY(${realmIds})`))
              .orderBy(desc(Unit.createdAt));
          const seen = new Set<string>();
          const deduped: typeof rows = [];
          for (const row of rows) {
            if (!seen.has(row.Unit.id)) {
              seen.add(row.Unit.id);
              deduped.push(row);
            }
          }
          return deduped.map((r) => realmToDTO(r.Unit, r.title ?? null));
        }).pipe(Effect.orDie),
      )

      // ── listByMember — list realms a specific user belongs to ──
      // 获取指定用户加入的 realm 列表
      .handle("listByMember", ({ params }) =>
        Effect.gen(function* () {
          const memberships = yield* 
            database
              .select({ realmUnitId: RealmMemberTable.realmUnitId })
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.userId, params.userId), eq(RealmMemberTable.state, "ACTIVE")));
          if (memberships.length === 0) return [];
          const realmIds = memberships.map((m) => m.realmUnitId);
          const rows = yield* 
            database
              .select({
                Unit,
                Realm: RealmTable,
                title: UnitTranslation.title,
              })
              .from(RealmTable)
              .innerJoin(Unit, eq(RealmTable.unitId, Unit.id))
              .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
              .where(and(eq(Unit.type, "REALM"), sql`${Unit.id} = ANY(${realmIds})`))
              .orderBy(desc(Unit.createdAt));
          const seen = new Set<string>();
          const deduped: typeof rows = [];
          for (const row of rows) {
            if (!seen.has(row.Unit.id)) {
              seen.add(row.Unit.id);
              deduped.push(row);
            }
          }
          return deduped.map((r) => realmToDTO(r.Unit, r.title ?? null));
        }).pipe(Effect.orDie),
      )

      // ── create — create a new realm ────────────────────────────
      // 创建 realm（同时创建 Unit + Realm + 自动加入创建者）
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Check slug uniqueness among realm-type units
          // 检查 slug 在 realm 类型 unit 中的唯一性
          const existing = yield* 
            database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.slug, payload.slug), eq(Unit.type, "REALM")))
              .limit(1);
          if (existing.length > 0) return yield* new RealmSlugConflict();

          // Create Unit with type REALM; realms are self-scoped (slugScope = own id).
          // 创建 type=REALM 的 Unit；realm 以自身为 slug 作用域。
          const units = yield* 
            database
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
              .returning();
          const unit = units[0]!;

          // Self-scope the slug now that we have the ID
          // 现在有了 ID，将 slug 作用域设为自身
          yield* database.update(Unit).set({ slugScope: unit.id }).where(eq(Unit.id, unit.id));

          // Create UnitTranslation for the realm name
          // 创建 UnitTranslation 存储 realm 名称
          yield* 
            database.insert(UnitTranslation).values({
              unitId: unit.id,
              language: "en",
              title: payload.name,
              summary: payload.description ?? null,
            });

          // Create the Realm row
          // 创建 Realm 行
          yield* 
            database.insert(RealmTable).values({
              unitId: unit.id,
              isPublic: true,
              memberCount: 1,
            });

          // Auto-join creator as owner
          // 自动将创建者加入为 owner
          yield* 
            database.insert(RealmMemberTable).values({
              realmUnitId: unit.id,
              userId: user.id,
              roleKey: "owner",
              state: "ACTIVE",
            });

          return realmToDTO({ ...unit, slugScope: unit.id }, payload.name);
        }).pipe(Effect.orDie),
      )

      // ── update — update realm name/slug/description ────────────
      // 更新 realm 名称/slug/描述
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Check slug uniqueness if slug is being changed
          // 如果 slug 正在被更改，检查唯一性
          if (payload.slug !== undefined && payload.slug !== found.unit.slug) {
            const conflict = yield* 
              database
                .select({ id: Unit.id })
                .from(Unit)
                .where(and(eq(Unit.slug, payload.slug), eq(Unit.type, "REALM")))
                .limit(1);
            if (conflict.length > 0) return yield* new RealmSlugConflict();
          }

          // Update Unit slug if provided
          // 更新 Unit slug（如果提供了）
          if (payload.slug !== undefined) {
            yield* 
              database.update(Unit).set({ slug: payload.slug, updatedAt: new Date() }).where(eq(Unit.id, params.unitId));
          }

          // Update UnitTranslation for name/description
          // 更新 UnitTranslation 中的名称/描述
          if (payload.name !== undefined || payload.description !== undefined) {
            const translationSets: Partial<typeof UnitTranslation.$inferInsert> = { updatedAt: new Date() };
            if (payload.name !== undefined) translationSets.title = payload.name;
            if (payload.description !== undefined) translationSets.summary = payload.description;
            yield* 
              database
                .insert(UnitTranslation)
                .values({
                  unitId: params.unitId,
                  language: "en",
                  title: payload.name ?? found.title,
                  summary: payload.description !== undefined ? payload.description : undefined,
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: translationSets,
                });
          }

          // Re-fetch to return fresh state
          // 重新获取以返回最新状态
          const updated = yield* requireRealm(params.unitId);
          return realmToDTO(updated.unit, updated.title);
        }).pipe(Effect.orDie),
      )

      // ── delete — delete realm (cascades via Unit FK)  ──────────
      // 删除 realm（通过 Unit 外键级联）
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Deleting the Unit cascades to Realm, RealmMember, UnitRealm, etc.
          // 删除 Unit 会级联到 Realm、RealmMember、UnitRealm 等
          yield* database.delete(Unit).where(eq(Unit.id, params.unitId));
        }).pipe(Effect.orDie),
      )

      // ── getMyMembership — check current user's membership ──────
      // 检查当前用户的成员状态
      .handle("getMyMembership", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          const rows = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, user.id)))
              .limit(1);
          if (!rows[0]) return null;
          return memberToDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── listMembers — list members of a realm ──────────────────
      // 列出 realm 成员
      .handle("listMembers", ({ params, query }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);
          const rows = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.state, "ACTIVE")))
              .orderBy(RealmMemberTable.joinedAt)
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(memberToDTO);
        }).pipe(Effect.orDie),
      )

      // ── addMember — join a realm ───────────────────────────────
      // 加入 realm
      .handle("addMember", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* requireRealm(params.unitId);

          // Determine the target userId: self-join when payload.userId is absent
          // 确定目标 userId: 当 payload.userId 缺失时为自加入
          const targetUserId = payload.userId ?? user.id;

          // Check for existing membership
          // 检查现有成员关系
          const existing = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
              )
              .limit(1);
          if (existing[0] && existing[0].state === "ACTIVE") return yield* new RealmAlreadyMember();

          // Determine initial state based on realm approval setting
          // 根据 realm 审核设置确定初始状态
          const initialState = found.realm.joinRequiresApproval ? "PENDING" : "ACTIVE";
          const memberCountDelta = initialState === "ACTIVE" ? 1 : 0;

          if (existing[0]) {
            // Re-activate a previously removed/banned member
            // 重新激活之前被移除/封禁的成员
            yield* 
              database
                .update(RealmMemberTable)
                .set({ state: initialState, roleKey: "member", updatedAt: new Date() })
                .where(
                  and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
                );
          } else {
            yield* 
              database.insert(RealmMemberTable).values({
                realmUnitId: params.unitId,
                userId: targetUserId,
                roleKey: "member",
                state: initialState,
              });
          }

          // Update member count
          // 更新成员计数
          if (memberCountDelta > 0) {
            yield* 
              database
                .update(RealmTable)
                .set({ memberCount: sql`${RealmTable.memberCount} + 1` })
                .where(eq(RealmTable.unitId, params.unitId));
          }

          const rows = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, targetUserId)),
              )
              .limit(1);
          return memberToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── updateMember — update member role ──────────────────────
      // 更新成员角色
      .handle("updateMember", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          const existing = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(
                and(
                  eq(RealmMemberTable.realmUnitId, params.unitId),
                  eq(RealmMemberTable.userId, params.userId),
                  eq(RealmMemberTable.state, "ACTIVE"),
                ),
              )
              .limit(1);
          if (!existing[0]) return yield* new RealmMemberNotFound();

          const sets: Partial<typeof RealmMemberTable.$inferInsert> = { updatedAt: new Date() };
          if (payload.role !== undefined) sets.roleKey = payload.role;

          yield* 
            database
              .update(RealmMemberTable)
              .set(sets)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              );

          const rows = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              )
              .limit(1);
          return memberToDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── removeMember — leave/remove from realm ─────────────────
      // 离开/移除 realm
      .handle("removeMember", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* requireRealm(params.unitId);

          const existing = yield* 
            database
              .select()
              .from(RealmMemberTable)
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              )
              .limit(1);
          if (!existing[0] || existing[0].state !== "ACTIVE") return yield* new RealmMemberNotFound();

          yield* 
            database
              .update(RealmMemberTable)
              .set({ state: "REMOVED", updatedAt: new Date() })
              .where(
                and(eq(RealmMemberTable.realmUnitId, params.unitId), eq(RealmMemberTable.userId, params.userId)),
              );

          // Decrement member count
          // 递减成员计数
          yield* 
            database
              .update(RealmTable)
              .set({ memberCount: sql`GREATEST(${RealmTable.memberCount} - 1, 0)` })
              .where(eq(RealmTable.unitId, params.unitId));
        }).pipe(Effect.orDie),
      )

      // ── getResolvedRules — return rules for a realm (flat list of current revision items) ──
      // 获取 realm 的规则（当前修订版本条目的平坦列表）
      .handle("getResolvedRules", ({ params }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);

          // Fetch the realm's rule policy with its current revision, then load items
          // 获取 realm 的规则策略及其当前修订版本，然后加载条目
          const policies = yield* 
            database
              .select()
              .from(RealmRulePolicy)
              .where(eq(RealmRulePolicy.realmUnitId, params.unitId));

          const policyIds = policies
            .filter((p) => p.currentRevisionId !== null)
            .map((p) => p.currentRevisionId!);
          if (policyIds.length === 0) return [];

          const items = yield* 
            database
              .select()
              .from(RealmRuleItem)
              .where(inArray(RealmRuleItem.revisionId, policyIds))
              .orderBy(asc(RealmRuleItem.position));

          // Load translation titles for rule post units
          // 加载规则帖子 unit 的翻译标题
          const ruleUnitIds = items.map((i) => i.rulePostUnitId);
          const translations =
            ruleUnitIds.length > 0
              ? yield* database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, ruleUnitIds))
              : [];
          const titleMap = new Map<string, string>();
          for (const t of translations) {
            if (t.title && !titleMap.has(t.unitId)) titleMap.set(t.unitId, t.title);
          }

          return items.map(
            (item) =>
              new RealmRuleEntryDTO({
                id: item.id,
                realmUnitId: params.unitId,
                title: titleMap.get(item.rulePostUnitId) ?? item.rulePostUnitId,
              }),
          );
        }).pipe(Effect.orDie),
      )

      // ── listRules — list rule policies for a realm ─────────────
      // 列出 realm 的规则策略
      .handle("listRules", ({ params }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);

          const policies = yield* 
            database
              .select()
              .from(RealmRulePolicy)
              .where(eq(RealmRulePolicy.realmUnitId, params.unitId))
              .orderBy(asc(RealmRulePolicy.createdAt));

          return policies.map(
            (p) =>
              new RealmRuleEntryDTO({
                id: p.id,
                realmUnitId: params.unitId,
                title: p.id, // Policy title is the id; enriched by client via getResolvedRules
              }),
          );
        }).pipe(Effect.orDie),
      )

      // ── createRule — create a new rule policy for a realm ──────
      // 为 realm 创建新规则策略
      .handle("createRule", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Create a post Unit to hold the rule text
          // 创建一个帖子 Unit 来存放规则文本
          const postUnits = yield* 
            database
              .insert(Unit)
              .values({
                type: "POST",
                userId: user.id,
                slugScope: params.unitId,
                status: "PUBLISHED",
              })
              .returning();
          const postUnit = postUnits[0]!;

          yield* 
            database.insert(UnitTranslation).values({
              unitId: postUnit.id,
              language: "en",
              title: payload.title,
              summary: payload.description ?? null,
            });

          // Create the policy
          // 创建策略
          const policyRows = yield* 
            database.insert(RealmRulePolicy).values({ realmUnitId: params.unitId }).returning();
          const policy = policyRows[0]!;

          // Create the first revision
          // 创建第一个修订版本
          const revisionRows = yield* 
            database
              .insert(RealmRuleRevisionTable)
              .values({ policyId: policy.id, version: 1, createdByUserId: user.id })
              .returning();
          const revision = revisionRows[0]!;

          // Link the revision as current
          // 将此修订版本设为当前版本
          yield* 
            database
              .update(RealmRulePolicy)
              .set({ currentRevisionId: revision.id, updatedAt: new Date() })
              .where(eq(RealmRulePolicy.id, policy.id));

          // Create the rule item referencing the post
          // 创建引用帖子的规则条目
          yield* 
            database.insert(RealmRuleItem).values({
              policyId: policy.id,
              revisionId: revision.id,
              rulePostUnitId: postUnit.id,
              position: payload.position !== undefined ? String(payload.position) : "V",
            });

          return new RealmRuleEntryDTO({
            id: policy.id,
            realmUnitId: params.unitId,
            title: payload.title,
          });
        }).pipe(Effect.orDie),
      )

      // ── createRuleRevision — create a new revision for an existing rule ──
      // 为现有规则创建新修订版本
      .handle("createRuleRevision", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Verify the rule policy exists in this realm
          // 验证此 realm 中存在该规则策略
          const policies = yield* 
            database
              .select()
              .from(RealmRulePolicy)
              .where(
                and(eq(RealmRulePolicy.id, payload.ruleId), eq(RealmRulePolicy.realmUnitId, params.unitId)),
              )
              .limit(1);
          if (!policies[0]) return yield* new RealmNotFound();

          // Find max version
          // 查找最大版本号
          const maxVersionAgg = yield* 
            database
              .select({ maxVersion: sql<number>`coalesce(max(${RealmRuleRevisionTable.version}), 0)` })
              .from(RealmRuleRevisionTable)
              .where(eq(RealmRuleRevisionTable.policyId, payload.ruleId));
          const nextVersion = Number(maxVersionAgg[0]?.maxVersion ?? 0) + 1;

          const revisionRows = yield* 
            database
              .insert(RealmRuleRevisionTable)
              .values({ policyId: payload.ruleId, version: nextVersion, createdByUserId: user.id })
              .returning();
          const revision = revisionRows[0]!;

          // Update the policy's current revision
          // 更新策略的当前修订版本
          yield* 
            database
              .update(RealmRulePolicy)
              .set({ currentRevisionId: revision.id, updatedAt: new Date() })
              .where(eq(RealmRulePolicy.id, payload.ruleId));

          return new RealmRuleRevisionDTO({ id: revision.id, ruleId: payload.ruleId });
        }).pipe(Effect.orDie),
      )

      // ── acknowledgeRules — record that the user has acknowledged current rules ──
      // 记录用户已确认当前规则
      .handle("acknowledgeRules", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);

          // Get all policies with current revisions
          // 获取所有有当前修订版本的策略
          const policies = yield* 
            database
              .select()
              .from(RealmRulePolicy)
              .where(eq(RealmRulePolicy.realmUnitId, params.unitId));

          for (const policy of policies) {
            if (!policy.currentRevisionId) continue;

            // Fetch revision version
            // 获取修订版本号
            const revisions = yield* 
              database
                .select()
                .from(RealmRuleRevisionTable)
                .where(eq(RealmRuleRevisionTable.id, policy.currentRevisionId))
                .limit(1);
            if (!revisions[0]) continue;

            yield* 
              database
                .insert(RealmRuleAcknowledgement)
                .values({
                  realmUnitId: params.unitId,
                  policyId: policy.id,
                  revisionId: policy.currentRevisionId,
                  version: revisions[0].version,
                  userId: user.id,
                })
                .onConflictDoNothing();
          }
        }).pipe(Effect.orDie),
      )

      // ── mute — mute a realm (set member state to MUTED) ───────
      // 静音 realm（将成员状态设置为 MUTED）
      .handle("mute", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);

          yield* 
            database
              .update(RealmMemberTable)
              .set({ state: "MUTED", updatedAt: new Date() })
              .where(
                and(
                  eq(RealmMemberTable.realmUnitId, params.unitId),
                  eq(RealmMemberTable.userId, user.id),
                  eq(RealmMemberTable.state, "ACTIVE"),
                ),
              );
        }).pipe(Effect.orDie),
      )

      // ── unmute — unmute a realm (restore member state to ACTIVE) ──
      // 取消静音 realm（将成员状态恢复为 ACTIVE）
      .handle("unmute", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);

          yield* 
            database
              .update(RealmMemberTable)
              .set({ state: "ACTIVE", updatedAt: new Date() })
              .where(
                and(
                  eq(RealmMemberTable.realmUnitId, params.unitId),
                  eq(RealmMemberTable.userId, user.id),
                  eq(RealmMemberTable.state, "MUTED"),
                ),
              );
        }).pipe(Effect.orDie),
      )

      // ── addContent — add a unit to a realm's content feed ──────
      // 向 realm 的内容 feed 添加 unit
      .handle("addContent", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const found = yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Determine moderation status based on realm setting
          // 根据 realm 设置确定审核状态
          const moderationStatus = found.realm.contentRequiresApproval ? "PENDING" : "APPROVED";

          yield* 
            database
              .insert(UnitRealm)
              .values({
                realmUnitId: params.unitId,
                unitId: payload.contentUnitId,
                moderationStatus,
              })
              .onConflictDoNothing();

          return new RealmContentEntryDTO({
            id: payload.contentUnitId,
            realmUnitId: params.unitId,
            contentUnitId: payload.contentUnitId,
          });
        }).pipe(Effect.orDie),
      )

      // ── removeContent — remove a unit from a realm's content feed ──
      // 从 realm 的内容 feed 移除 unit
      .handle("removeContent", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          const deleted = yield* 
            database
              .delete(UnitRealm)
              .where(
                and(eq(UnitRealm.realmUnitId, params.unitId), eq(UnitRealm.unitId, params.contentUnitId)),
              )
              .returning();
          if (!deleted[0]) return yield* new RealmContentNotFound();
        }).pipe(Effect.orDie),
      )

      // ── addTags — add tags to a realm's own UnitTag set ────────
      // 向 realm 自身的 UnitTag 集合添加标签
      .handle("addTags", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          for (const tagUnitId of payload.tagUnitIds) {
            yield* 
              database
                .insert(UnitTag)
                .values({ unitId: params.unitId, tagUnitId, updatedAt: new Date() })
                .onConflictDoNothing();
          }
        }).pipe(Effect.orDie),
      )

      // ── removeTags — remove tags from a realm's own UnitTag set ──
      // 从 realm 自身的 UnitTag 集合移除标签
      .handle("removeTags", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          if (payload.tagUnitIds.length > 0) {
            yield* 
              database
                .delete(UnitTag)
                .where(
                  and(eq(UnitTag.unitId, params.unitId), inArray(UnitTag.tagUnitId, [...payload.tagUnitIds])),
                );
          }
        }).pipe(Effect.orDie),
      )

      // ── getDock — get realm dock (structured sidebar/nav data) ─
      // 获取 realm dock（结构化侧边栏/导航数据）
      .handle("getDock", ({ params }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);
          return new RealmDockDTO({ realmUnitId: params.unitId });
        }).pipe(Effect.orDie),
      )

      // ── updateDock — update realm dock ─────────────────────────
      // 更新 realm dock
      .handle("updateDock", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Store dock data as JSON in the Realm.dock column
          // 将 dock 数据作为 JSON 存储在 Realm.dock 列中
          yield* 
            database
              .update(RealmTable)
              .set({ dock: payload.items, updatedAt: new Date() })
              .where(eq(RealmTable.unitId, params.unitId));

          return new RealmDockDTO({ realmUnitId: params.unitId });
        }).pipe(Effect.orDie),
      )

      // ── setExtra — set a key-value pair in realm extra JSON ────
      // 在 realm extra JSON 中设置键值对
      .handle("setExtra", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Merge the key into existing extra JSON using jsonb_set
          // 使用 jsonb_set 将键合并到现有 extra JSON 中
          yield* 
            database
              .update(RealmTable)
              .set({
                extra: sql`jsonb_set(coalesce(${RealmTable.extra}, '{}'::jsonb), ${sql.raw(`'{${params.key}}'`)}, ${JSON.stringify(payload.value)}::jsonb)`,
                updatedAt: new Date(),
              })
              .where(eq(RealmTable.unitId, params.unitId));
        }).pipe(Effect.orDie),
      )

      // ── deleteExtra — remove a key from realm extra JSON ───────
      // 从 realm extra JSON 中移除键
      .handle("deleteExtra", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          yield* 
            database
              .update(RealmTable)
              .set({
                extra: sql`coalesce(${RealmTable.extra}, '{}'::jsonb) - ${params.key}`,
                updatedAt: new Date(),
              })
              .where(eq(RealmTable.unitId, params.unitId));
        }).pipe(Effect.orDie),
      )

      // ── getTagTree — get the realm's tag tree structure ────────
      // 获取 realm 的标签树结构
      .handle("getTagTree", ({ params }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);

          // Query is issued to verify the table is reachable; DTO is a thin envelope.
          // 发出查询以验证表可达；DTO 是一个薄信封。
          yield* 
            database
              .select()
              .from(RealmTagTreeTable)
              .where(eq(RealmTagTreeTable.realmUnitId, params.unitId))
              .limit(1);

          return new RealmTagTreeDTO({ realmUnitId: params.unitId });
        }).pipe(Effect.orDie),
      )

      // ── updateTagTree — update the realm's tag tree structure ──
      // 更新 realm 的标签树结构
      .handle("updateTagTree", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          yield* 
            database
              .insert(RealmTagTreeTable)
              .values({ realmUnitId: params.unitId, tree: payload.tree })
              .onConflictDoUpdate({
                target: RealmTagTreeTable.realmUnitId,
                set: { tree: payload.tree, updatedAt: new Date() },
              });

          return new RealmTagTreeDTO({ realmUnitId: params.unitId });
        }).pipe(Effect.orDie),
      )

      // ── getPinboard — get a pinboard by key ────────────────────
      // 按 key 获取钉板
      .handle("getPinboard", ({ params }) =>
        Effect.gen(function* () {
          yield* requireRealm(params.unitId);

          const boards = yield* 
            database
              .select()
              .from(PinboardTable)
              .where(
                and(eq(PinboardTable.realmUnitId, params.unitId), eq(PinboardTable.key, params.key)),
              )
              .limit(1);
          if (!boards[0]) return yield* new PinboardNotFound();

          return new PinboardEntryDTO({
            id: boards[0].id,
            realmUnitId: params.unitId,
            key: params.key,
          });
        }).pipe(Effect.orDie),
      )

      // ── addPinboardEntry — add an entry to a pinboard ──────────
      // 向钉板添加条目
      .handle("addPinboardEntry", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          // Find or create the pinboard
          // 查找或创建钉板
          const boards = yield* 
            database
              .select()
              .from(PinboardTable)
              .where(
                and(eq(PinboardTable.realmUnitId, params.unitId), eq(PinboardTable.key, params.key)),
              )
              .limit(1);

          const pinboardId = boards[0]
            ? boards[0].id
            : (yield* Effect.gen(function* () {
                const created = yield* 
                  database
                    .insert(PinboardTable)
                    .values({ realmUnitId: params.unitId, key: params.key })
                    .returning();
                return created[0]!.id;
              }));

          // Find the max position to append at the end
          // 查找最大位置以追加到末尾
          const maxPosAgg = yield* 
            database
              .select({ maxPos: sql<string>`coalesce(max(${PinboardEntryTable.position}), 'V')` })
              .from(PinboardEntryTable)
              .where(eq(PinboardEntryTable.pinboardId, pinboardId));
          const nextPosition = (maxPosAgg[0]?.maxPos ?? "V") + "V";

          const entryRows = yield* 
            database
              .insert(PinboardEntryTable)
              .values({ pinboardId, unitId: payload.unitId, position: nextPosition })
              .onConflictDoNothing()
              .returning();

          // If conflict (entry already exists), fetch the existing one
          // 如果冲突（条目已存在），获取现有条目
          const entry = entryRows[0]
            ?? (yield* Effect.gen(function* () {
                const rows = yield* 
                  database
                    .select()
                    .from(PinboardEntryTable)
                    .where(
                      and(
                        eq(PinboardEntryTable.pinboardId, pinboardId),
                        eq(PinboardEntryTable.unitId, payload.unitId),
                      ),
                    )
                    .limit(1);
                return rows[0]!;
              }));

          return new PinboardEntryDTO({
            id: entry.id,
            realmUnitId: params.unitId,
            key: params.key,
          });
        }).pipe(Effect.orDie),
      )

      // ── reorderPinboard — reorder pinboard entries ─────────────
      // 重新排序钉板条目
      .handle("reorderPinboard", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          const boards = yield* 
            database
              .select()
              .from(PinboardTable)
              .where(
                and(eq(PinboardTable.realmUnitId, params.unitId), eq(PinboardTable.key, params.key)),
              )
              .limit(1);
          if (!boards[0]) return yield* new PinboardNotFound();

          // Assign sequential positions based on the provided order
          // 根据提供的顺序分配序号位置
          for (const [index, entryId] of payload.orderedIds.entries()) {
            const position = String(index).padStart(8, "0");
            yield* 
              database
                .update(PinboardEntryTable)
                .set({ position, updatedAt: new Date() })
                .where(
                  and(eq(PinboardEntryTable.id, entryId), eq(PinboardEntryTable.pinboardId, boards[0].id)),
                );
          }
        }).pipe(Effect.orDie),
      )

      // ── deletePinboardEntry — delete a pinboard entry ──────────
      // 删除钉板条目
      .handle("deletePinboardEntry", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealm(params.unitId);
          yield* requireRealmAdmin(params.unitId, user.id);

          const boards = yield* 
            database
              .select()
              .from(PinboardTable)
              .where(
                and(eq(PinboardTable.realmUnitId, params.unitId), eq(PinboardTable.key, params.key)),
              )
              .limit(1);
          if (!boards[0]) return yield* new PinboardNotFound();

          const deleted = yield* 
            database
              .delete(PinboardEntryTable)
              .where(
                and(eq(PinboardEntryTable.id, payload.entryId), eq(PinboardEntryTable.pinboardId, boards[0].id)),
              )
              .returning();
          if (!deleted[0]) return yield* new PinboardNotFound();
        }).pipe(Effect.orDie),
      );
  }),
);

// ---------------------------------------------------------------------------
// RealmTagApplicationsHandlers — realm-scoped tag application CRUD
// realm 作用域的标签申请 CRUD
// ---------------------------------------------------------------------------

export const RealmTagApplicationsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplications",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Shared: aggregate votes for a realm tag application
    // 共享: 聚合 realm 标签申请的投票
    const aggregateVotes = (realmUnitId: string, tagUnitId: string, unitId: string) =>
      Effect.gen(function* () {
        const agg = yield* 
          database
            .select({
              score: sql<number>`coalesce(sum(${RealmTagApplicationVoteTable.value}), 0)`,
              voteCount: count(RealmTagApplicationVoteTable.value),
            })
            .from(RealmTagApplicationVoteTable)
            .where(
              and(
                eq(RealmTagApplicationVoteTable.realmUnitId, realmUnitId),
                eq(RealmTagApplicationVoteTable.tagUnitId, tagUnitId),
                eq(RealmTagApplicationVoteTable.unitId, unitId),
              ),
            );
        return {
          score: Number(agg[0]?.score ?? 0),
          voteCount: Number(agg[0]?.voteCount ?? 0),
        };
      });

    return handlers
      // ── create — create a realm tag application ────────────────
      // 创建 realm 标签申请
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify realm exists
          // 验证 realm 存在
          const realms = yield* 
            database.select().from(RealmTable).where(eq(RealmTable.unitId, payload.realmUnitId)).limit(1);
          if (!realms[0]) return yield* new RealmNotFound();

          // Insert the user's +1 vote via upsert
          // 通过 upsert 插入用户的 +1 投票
          yield* 
            database
              .insert(RealmTagApplicationVoteTable)
              .values({
                realmUnitId: payload.realmUnitId,
                tagUnitId: payload.tagUnitId,
                unitId: payload.unitId,
                userId: user.id,
                value: 1,
              })
              .onConflictDoNothing();

          // Recompute aggregates and upsert the application row
          // 重新计算聚合值并 upsert 申请行
          const agg = yield* aggregateVotes(payload.realmUnitId, payload.tagUnitId, payload.unitId);

          yield* 
            database
              .insert(RealmTagApplicationTable)
              .values({
                realmUnitId: payload.realmUnitId,
                tagUnitId: payload.tagUnitId,
                unitId: payload.unitId,
                score: agg.score,
                voteCount: agg.voteCount,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [
                  RealmTagApplicationTable.realmUnitId,
                  RealmTagApplicationTable.tagUnitId,
                  RealmTagApplicationTable.unitId,
                ],
                set: { score: agg.score, voteCount: agg.voteCount, updatedAt: new Date() },
              });

          return new RealmTagApplicationDTO({
            realmUnitId: payload.realmUnitId,
            unitId: payload.unitId,
            tagUnitId: payload.tagUnitId,
          });
        }).pipe(Effect.orDie),
      )

      // ── listForUnit — list tag applications for a unit within a realm ──
      // 列出 realm 内某个 unit 的标签申请
      .handle("listForUnit", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* 
            database
              .select()
              .from(RealmTagApplicationTable)
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagApplicationTable.unitId, params.unitId),
                ),
              )
              .orderBy(desc(RealmTagApplicationTable.score), asc(RealmTagApplicationTable.tagUnitId));

          return rows.map(
            (r) =>
              new RealmTagApplicationDTO({
                realmUnitId: r.realmUnitId,
                unitId: r.unitId,
                tagUnitId: r.tagUnitId,
              }),
          );
        }).pipe(Effect.orDie),
      )

      // ── update — update a tag application (pin/position) ───────
      // 更新标签申请（置顶/排序）
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          const sets: Partial<typeof RealmTagApplicationTable.$inferInsert> = { updatedAt: new Date() };
          if (payload.status !== undefined) {
            // Status maps to pinned boolean for now
            // status 暂时映射到 pinned 布尔值
            sets.pinned = payload.status === "pinned";
          }

          const updated = yield* 
            database
              .update(RealmTagApplicationTable)
              .set(sets)
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagApplicationTable.unitId, params.unitId),
                  eq(RealmTagApplicationTable.tagUnitId, params.tagUnitId),
                ),
              )
              .returning();
          if (!updated[0]) return yield* new RealmTagApplicationNotFound();

          return new RealmTagApplicationDTO({
            realmUnitId: params.realmUnitId,
            unitId: params.unitId,
            tagUnitId: params.tagUnitId,
          });
        }).pipe(Effect.orDie),
      )

      // ── delete — delete a tag application and its votes ────────
      // 删除标签申请及其投票
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          // Votes cascade via FK, but delete explicitly for clarity
          // 投票通过 FK 级联，但为清晰起见显式删除
          yield* 
            database
              .delete(RealmTagApplicationVoteTable)
              .where(
                and(
                  eq(RealmTagApplicationVoteTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagApplicationVoteTable.unitId, params.unitId),
                  eq(RealmTagApplicationVoteTable.tagUnitId, params.tagUnitId),
                ),
              );

          const deleted = yield* 
            database
              .delete(RealmTagApplicationTable)
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagApplicationTable.unitId, params.unitId),
                  eq(RealmTagApplicationTable.tagUnitId, params.tagUnitId),
                ),
              )
              .returning();
          if (!deleted[0]) return yield* new RealmTagApplicationNotFound();
        }).pipe(Effect.orDie),
      );
  }),
);

// ---------------------------------------------------------------------------
// RealmTagApplicationVotesHandlers — vote on realm tag applications
// 对 realm 标签申请投票
// ---------------------------------------------------------------------------

export const RealmTagApplicationVotesHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplicationVotes",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // ── create — cast a vote on a tag application ──────────────
      // 对标签申请投票
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const clampedValue = payload.direction === "up" ? 1 : -1;

          // Verify the application exists
          // 验证申请存在
          const apps = yield* 
            database
              .select()
              .from(RealmTagApplicationTable)
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationTable.unitId, payload.unitId),
                ),
              )
              .limit(1);
          if (!apps[0]) return yield* new RealmTagApplicationNotFound();

          // Upsert the vote
          // upsert 投票
          yield* 
            database
              .insert(RealmTagApplicationVoteTable)
              .values({
                realmUnitId: payload.realmUnitId,
                tagUnitId: payload.tagUnitId,
                unitId: payload.unitId,
                userId: user.id,
                value: clampedValue,
              })
              .onConflictDoUpdate({
                target: [
                  RealmTagApplicationVoteTable.realmUnitId,
                  RealmTagApplicationVoteTable.tagUnitId,
                  RealmTagApplicationVoteTable.unitId,
                  RealmTagApplicationVoteTable.userId,
                ],
                set: { value: clampedValue },
              });

          // Recompute and update aggregates on the application
          // 重新计算并更新申请上的聚合值
          const agg = yield* 
            database
              .select({
                score: sql<number>`coalesce(sum(${RealmTagApplicationVoteTable.value}), 0)`,
                voteCount: count(RealmTagApplicationVoteTable.value),
              })
              .from(RealmTagApplicationVoteTable)
              .where(
                and(
                  eq(RealmTagApplicationVoteTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationVoteTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationVoteTable.unitId, payload.unitId),
                ),
              );

          yield* 
            database
              .update(RealmTagApplicationTable)
              .set({
                score: Number(agg[0]?.score ?? 0),
                voteCount: Number(agg[0]?.voteCount ?? 0),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationTable.unitId, payload.unitId),
                ),
              );

          return new RealmTagApplicationVoteDTO({
            id: `${payload.realmUnitId}:${payload.tagUnitId}:${payload.unitId}:${user.id}`,
          });
        }).pipe(Effect.orDie),
      )

      // ── delete — retract a vote ────────────────────────────────
      // 撤回投票
      .handle("delete", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify the application exists
          // 验证申请存在
          const apps = yield* 
            database
              .select()
              .from(RealmTagApplicationTable)
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationTable.unitId, payload.unitId),
                ),
              )
              .limit(1);
          if (!apps[0]) return yield* new RealmTagApplicationNotFound();

          yield* 
            database
              .delete(RealmTagApplicationVoteTable)
              .where(
                and(
                  eq(RealmTagApplicationVoteTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationVoteTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationVoteTable.unitId, payload.unitId),
                  eq(RealmTagApplicationVoteTable.userId, user.id),
                ),
              );

          // Recompute aggregates
          // 重新计算聚合值
          const agg = yield* 
            database
              .select({
                score: sql<number>`coalesce(sum(${RealmTagApplicationVoteTable.value}), 0)`,
                voteCount: count(RealmTagApplicationVoteTable.value),
              })
              .from(RealmTagApplicationVoteTable)
              .where(
                and(
                  eq(RealmTagApplicationVoteTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationVoteTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationVoteTable.unitId, payload.unitId),
                ),
              );

          yield* 
            database
              .update(RealmTagApplicationTable)
              .set({
                score: Number(agg[0]?.score ?? 0),
                voteCount: Number(agg[0]?.voteCount ?? 0),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(RealmTagApplicationTable.realmUnitId, payload.realmUnitId),
                  eq(RealmTagApplicationTable.tagUnitId, payload.tagUnitId),
                  eq(RealmTagApplicationTable.unitId, payload.unitId),
                ),
              );
        }).pipe(Effect.orDie),
      );
  }),
);

// ---------------------------------------------------------------------------
// RealmTagContextsHandlers — contextual tag metadata within a realm
// realm 内的上下文标签元数据
// ---------------------------------------------------------------------------

export const RealmTagContextsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagContexts",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // ── get — fetch the tag context for a (realm, tag) pair ────
      // 获取 (realm, tag) 配对的标签上下文
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          // Query issued for reachability; DTO is a thin envelope.
          // 发出查询以验证可达性；DTO 是一个薄信封。
          yield* 
            database
              .select()
              .from(RealmTagContextTable)
              .where(
                and(
                  eq(RealmTagContextTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagContextTable.tagUnitId, params.tagUnitId),
                ),
              )
              .limit(1);

          return new RealmTagContextDTO({
            realmUnitId: params.realmUnitId,
            tagUnitId: params.tagUnitId,
          });
        }).pipe(Effect.orDie),
      )

      // ── update — upsert the tag context for a (realm, tag) pair ──
      // upsert (realm, tag) 配对的标签上下文
      .handle("update", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          yield* 
            database
              .insert(RealmTagContextTable)
              .values({
                realmUnitId: params.realmUnitId,
                tagUnitId: params.tagUnitId,
              })
              .onConflictDoUpdate({
                target: [RealmTagContextTable.realmUnitId, RealmTagContextTable.tagUnitId],
                set: { updatedAt: new Date() },
              });

          return new RealmTagContextDTO({
            realmUnitId: params.realmUnitId,
            tagUnitId: params.tagUnitId,
          });
        }).pipe(Effect.orDie),
      )

      // ── materialize — create a context Unit for the (realm, tag) pair ──
      // 为 (realm, tag) 配对创建上下文 Unit
      .handle("materialize", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Check if a context already exists with a contextUnitId
          // 检查是否已存在带 contextUnitId 的上下文
          const existing = yield* 
            database
              .select()
              .from(RealmTagContextTable)
              .where(
                and(
                  eq(RealmTagContextTable.realmUnitId, params.realmUnitId),
                  eq(RealmTagContextTable.tagUnitId, params.tagUnitId),
                ),
              )
              .limit(1);

          if (existing[0]?.contextUnitId) {
            // Already materialized
            // 已经物化
            return new RealmTagContextDTO({
              realmUnitId: params.realmUnitId,
              tagUnitId: params.tagUnitId,
            });
          }

          // Create a POST unit to serve as the context page
          // 创建一个 POST unit 作为上下文页面
          const contextUnits = yield* 
            database
              .insert(Unit)
              .values({
                type: "POST",
                userId: user.id,
                slugScope: params.realmUnitId,
                status: "PUBLISHED",
              })
              .returning();
          const contextUnit = contextUnits[0]!;

          // Upsert the context row with the new contextUnitId
          // upsert 上下文行并设置新的 contextUnitId
          yield* 
            database
              .insert(RealmTagContextTable)
              .values({
                realmUnitId: params.realmUnitId,
                tagUnitId: params.tagUnitId,
                contextUnitId: contextUnit.id,
              })
              .onConflictDoUpdate({
                target: [RealmTagContextTable.realmUnitId, RealmTagContextTable.tagUnitId],
                set: { contextUnitId: contextUnit.id, updatedAt: new Date() },
              });

          return new RealmTagContextDTO({
            realmUnitId: params.realmUnitId,
            tagUnitId: params.tagUnitId,
          });
        }).pipe(Effect.orDie),
      );
  }),
);
