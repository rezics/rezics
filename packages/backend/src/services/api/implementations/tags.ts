import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, asc, count, desc, eq, gt, ilike, inArray, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  PolicyTagApplication,
  PolicyTagRule,
  SlugScope,
  TagVote,
  Unit,
  UnitTag,
  UnitTranslation,
  UserTagApplication,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser, CurrentUserOption } from "../interfaces/middlewares/auth.ts";
import {
  BatchTagTranslationEntry,
  PolicyTagApplicationEntry,
  PolicyTagApplicationListResult,
  PolicyTagRuleEntry,
  PolicyTagRuleListResult,
  TagConflict,
  TagForbidden,
  TagListResult,
  TagNotFound,
  TagUnitEntry,
  UnitTagEntry,
  UserTagApplicationEntry,
} from "../interfaces/tags.ts";

/**
 * Score at or below this threshold hides a UnitTag from regular users.
 * 分数等于或低于此阈值时，对普通用户隐藏该 UnitTag。
 */
const VISIBILITY_THRESHOLD = -100;

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function tagUnitToEntry(
  unit: typeof Unit.$inferSelect,
  translation: typeof UnitTranslation.$inferSelect | undefined,
): TagUnitEntry {
  return new TagUnitEntry({
    unitId: unit.id,
    slug: unit.slug ?? null,
    name: translation?.title ?? null,
    language: unit.defaultLanguage ?? null,
    createdAt: unit.createdAt,
  });
}

function unitTagToEntry(
  row: typeof UnitTag.$inferSelect,
  opts?: { belowVisibilityThreshold?: boolean; viewerVote?: number | null },
): UnitTagEntry {
  return new UnitTagEntry({
    unitId: row.unitId,
    tagUnitId: row.tagUnitId,
    score: row.score,
    voteCount: row.voteCount,
    pinned: row.pinned,
    position: row.position ?? null,
    belowVisibilityThreshold: opts?.belowVisibilityThreshold ?? undefined,
    viewerVote: opts?.viewerVote ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function policyRuleToEntry(row: typeof PolicyTagRule.$inferSelect): PolicyTagRuleEntry {
  return new PolicyTagRuleEntry({
    id: row.id,
    scopeKind: row.scopeKind,
    realmUnitId: row.realmUnitId ?? null,
    tagUnitId: row.tagUnitId,
    state: row.state,
    reason: row.reason ?? null,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function policyApplicationToEntry(row: typeof PolicyTagApplication.$inferSelect): PolicyTagApplicationEntry {
  return new PolicyTagApplicationEntry({
    id: row.id,
    ruleId: row.ruleId,
    unitId: row.unitId,
    position: row.position ?? null,
    metadata: row.metadata ?? null,
    appliedByUserId: row.appliedByUserId,
    updatedByUserId: row.updatedByUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function userTagAppToEntry(row: typeof UserTagApplication.$inferSelect): UserTagApplicationEntry {
  return new UserTagApplicationEntry({
    userId: row.userId,
    unitId: row.unitId,
    tagUnitId: row.tagUnitId,
    position: row.position ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// TagsHandlers (TagsGroup) / 标签处理器
// ---------------------------------------------------------------------------

export const TagsHandlers = HttpApiBuilder.group(
  Api,
  "tags",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared: resolve first translation for a tag unit / 获取标签 unit 的第一条翻译
    const resolveTranslation = (unitId: string, language?: string) =>
      Effect.gen(function* () {
        const conditions = [eq(UnitTranslation.unitId, unitId)];
        if (language) conditions.push(eq(UnitTranslation.language, language));
        const trans = yield* Effect.orDie(
          database
            .select()
            .from(UnitTranslation)
            .where(and(...conditions))
            .orderBy(asc(UnitTranslation.language))
            .limit(1),
        );
        return trans[0];
      });

    // Shared: aggregate tag votes for a unit+tag pair / 聚合 unit+标签 配对的投票
    const aggregateVotes = (unitId: string, tagUnitId: string) =>
      Effect.gen(function* () {
        const agg = yield* Effect.orDie(
          database
            .select({
              score: sql<number>`coalesce(sum(${TagVote.value}), 0)`,
              voteCount: count(TagVote.value),
            })
            .from(TagVote)
            .where(and(eq(TagVote.unitId, unitId), eq(TagVote.tagUnitId, tagUnitId))),
        );
        return {
          score: Number(agg[0]?.score ?? 0),
          voteCount: Number(agg[0]?.voteCount ?? 0),
        };
      });

    // Shared: upsert UnitTag with computed aggregates / 用计算的聚合值 upsert UnitTag
    const upsertUnitTagRow = (unitId: string, tagUnitId: string, agg: { score: number; voteCount: number }) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          database
            .insert(UnitTag)
            .values({
              unitId,
              tagUnitId,
              score: agg.score,
              voteCount: agg.voteCount,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UnitTag.unitId, UnitTag.tagUnitId],
              set: {
                score: agg.score,
                voteCount: agg.voteCount,
                updatedAt: new Date(),
              },
            })
            .returning(),
        );
        return rows[0]!;
      });

    // Shared: list tags implementation for both GET and POST / 列出标签的共享实现（GET 和 POST 通用）
    const listTagsImpl = (opts: {
      language?: string;
      name?: string;
      ids?: readonly string[];
      limit?: number;
      offset?: number;
    }) =>
      Effect.gen(function* () {
        const conditions: ReturnType<typeof eq>[] = [eq(Unit.type, "TAG"), eq(Unit.status, "PUBLISHED")];

        if (opts.ids && opts.ids.length > 0) {
          conditions.push(inArray(Unit.id, [...opts.ids]));
        }

        // Filter by name (search in translations) / 按名称过滤（在翻译中搜索）
        if (opts.name?.trim() || opts.language) {
          const translationConditions: ReturnType<typeof eq>[] = [];
          if (opts.name?.trim()) {
            translationConditions.push(ilike(UnitTranslation.title, `%${opts.name.trim()}%`));
          }
          if (opts.language) {
            translationConditions.push(eq(UnitTranslation.language, opts.language));
          }
          const matchingTranslations = yield* Effect.orDie(
            database
              .select({ unitId: UnitTranslation.unitId })
              .from(UnitTranslation)
              .where(and(...translationConditions)),
          );
          const matchingIds = [...new Set(matchingTranslations.map((r) => r.unitId))];
          if (matchingIds.length === 0) return new TagListResult({ tags: [], total: 0 });
          conditions.push(inArray(Unit.id, matchingIds));
        }

        const where = and(...conditions);
        const rows = yield* Effect.orDie(
          database
            .select()
            .from(Unit)
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(lim(opts.limit))
            .offset(opts.offset ?? 0),
        );
        const totalAgg = yield* Effect.orDie(database.select({ total: count() }).from(Unit).where(where));

        // Batch load translations / 批量加载翻译
        const unitIds = rows.map((r) => r.id);
        const translations =
          unitIds.length > 0
            ? yield* Effect.orDie(database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, unitIds)))
            : [];
        const transMap = new Map<string, typeof UnitTranslation.$inferSelect>();
        for (const t of translations) {
          // Prefer requested language, fallback to first available / 优先使用请求的语言，回退到首个可用的
          const key = t.unitId;
          const existing = transMap.get(key);
          if (!existing) {
            transMap.set(key, t);
          } else if (opts.language && t.language === opts.language) {
            transMap.set(key, t);
          }
        }

        const tags = rows.map((row) => tagUnitToEntry(row, transMap.get(row.id)));

        return new TagListResult({ tags, total: totalAgg[0]?.total ?? 0 });
      });

    return handlers
      // ── List tags (GET query string) / 列出标签（查询字符串） ──
      .handle("list", ({ query }) =>
        listTagsImpl({
          language: query.language,
          name: query.name,
          limit: query.limit,
          offset: query.offset,
        }),
      )

      // ── List tags (POST body) / 列出标签（请求体） ────────────
      .handle("listPost", ({ payload }) =>
        listTagsImpl({
          language: payload.language,
          name: payload.name,
          ids: payload.ids,
          limit: payload.limit,
          offset: payload.offset,
        }),
      )

      // ── Batch translations / 批量翻译 ────────────────────────
      .handle("batchTranslations", ({ query }) =>
        Effect.gen(function* () {
          const unitIds = (query.unitIds ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (unitIds.length === 0) return {} as Record<string, BatchTagTranslationEntry>;

          const language = query.lang ?? "en";

          // Fetch tag units / 获取标签 unit
          const tagUnits = yield* Effect.orDie(
            database.select().from(Unit).where(and(inArray(Unit.id, unitIds), eq(Unit.type, "TAG"))),
          );
          if (tagUnits.length === 0) return {} as Record<string, BatchTagTranslationEntry>;

          const tagIds = tagUnits.map((t) => t.id);
          const translations = yield* Effect.orDie(
            database
              .select()
              .from(UnitTranslation)
              .where(inArray(UnitTranslation.unitId, tagIds))
              .orderBy(asc(UnitTranslation.language)),
          );

          // Group translations by unitId / 按 unitId 分组翻译
          const transByUnit = new Map<string, Array<typeof UnitTranslation.$inferSelect>>();
          for (const t of translations) {
            const list = transByUnit.get(t.unitId) ?? [];
            list.push(t);
            transByUnit.set(t.unitId, list);
          }

          const result: Record<string, BatchTagTranslationEntry> = {};
          for (const tag of tagUnits) {
            const unitTranslations = transByUnit.get(tag.id) ?? [];
            const requested = unitTranslations.find((t) => t.language === language && t.title);
            const byDefault = tag.defaultLanguage
              ? unitTranslations.find((t) => t.language === tag.defaultLanguage && t.title)
              : undefined;
            const byFallback = unitTranslations.find((t) => t.language === "en" && t.title);
            const first = unitTranslations.find((t) => t.title);
            const pick = requested ?? byDefault ?? byFallback ?? first;

            result[tag.id] = new BatchTagTranslationEntry({
              unitId: tag.id,
              name: pick?.title ?? null,
              slug: tag.slug ?? null,
              description: pick?.description ? String(pick.description) : null,
            });
          }
          return result;
        }),
      )

      // ── Get tag by slug / 按 slug 获取标签 ──────────────────
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          // Resolve slug via SlugScope for tags / 通过 SlugScope 解析标签的 slug
          const slugScopes = yield* Effect.orDie(
            database.select({ unitId: SlugScope.unitId }).from(SlugScope).where(eq(SlugScope.slug, "tag")).limit(1),
          );
          const tagScopeId = slugScopes[0]?.unitId;

          const conditions = [eq(Unit.type, "TAG"), eq(Unit.slug, params.slug)];
          if (tagScopeId) conditions.push(eq(Unit.slugScope, tagScopeId));

          const units = yield* Effect.orDie(database.select().from(Unit).where(and(...conditions)).limit(1));
          if (!units[0]) return yield* new TagNotFound();

          const trans = yield* resolveTranslation(units[0].id);
          return tagUnitToEntry(units[0], trans);
        }),
      )

      // ── Get tag by ID / 按 ID 获取标签 ─────────────────────
      .handle("getById", ({ params }) =>
        Effect.gen(function* () {
          const units = yield* Effect.orDie(
            database
              .select()
              .from(Unit)
              .where(and(eq(Unit.id, params.unitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!units[0]) return yield* new TagNotFound();
          const trans = yield* resolveTranslation(units[0].id);
          return tagUnitToEntry(units[0], trans);
        }),
      )

      // ── Create tag / 创建标签 ──────────────────────────────
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const language = payload.language ?? "en";

          // Resolve tag slug scope / 解析标签 slug scope
          const slugScopes = yield* Effect.orDie(
            database.select({ unitId: SlugScope.unitId }).from(SlugScope).where(eq(SlugScope.slug, "tag")).limit(1),
          );
          const tagScopeId = slugScopes[0]?.unitId ?? user.id;

          // Check for slug conflict / 检查 slug 冲突
          const existing = yield* Effect.orDie(
            database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.type, "TAG"), eq(Unit.slug, payload.slug), eq(Unit.slugScope, tagScopeId)))
              .limit(1),
          );
          if (existing[0]) return yield* new TagConflict();

          const unitRows = yield* Effect.orDie(
            database
              .insert(Unit)
              .values({
                type: "TAG",
                slug: payload.slug,
                slugScope: tagScopeId,
                userId: user.id,
                defaultLanguage: language,
                isLanguageNeutral: true,
                status: "PUBLISHED",
              })
              .returning(),
          );
          const unit = unitRows[0]!;

          // Insert translation for the tag name / 插入标签名称的翻译
          yield* Effect.orDie(
            database.insert(UnitTranslation).values({
              unitId: unit.id,
              language,
              title: payload.name,
              updatedAt: new Date(),
            }),
          );

          const trans = yield* resolveTranslation(unit.id);
          return tagUnitToEntry(unit, trans);
        }),
      )

      // ── Update tag / 更新标签 ──────────────────────────────
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          const units = yield* Effect.orDie(
            database
              .select()
              .from(Unit)
              .where(and(eq(Unit.id, params.unitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!units[0]) return yield* new TagNotFound();

          const language = payload.language ?? units[0].defaultLanguage ?? "en";

          // Update slug if provided / 如果提供了 slug 则更新
          if (payload.slug !== undefined) {
            yield* Effect.orDie(
              database
                .update(Unit)
                .set({ slug: payload.slug, updatedAt: new Date() })
                .where(eq(Unit.id, params.unitId)),
            );
          }

          // Update translation name/description / 更新翻译名称/描述
          if (payload.name !== undefined) {
            yield* Effect.orDie(
              database
                .insert(UnitTranslation)
                .values({ unitId: params.unitId, language, title: payload.name, updatedAt: new Date() })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: { title: payload.name, updatedAt: new Date() },
                }),
            );
          }

          if (payload.description !== undefined) {
            yield* Effect.orDie(
              database
                .insert(UnitTranslation)
                .values({ unitId: params.unitId, language, description: payload.description, updatedAt: new Date() })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: { description: payload.description, updatedAt: new Date() },
                }),
            );
          }

          yield* Effect.orDie(database.update(Unit).set({ updatedAt: new Date() }).where(eq(Unit.id, params.unitId)));

          const updated = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)).limit(1));
          const trans = yield* resolveTranslation(params.unitId, language);
          return tagUnitToEntry(updated[0]!, trans);
        }),
      )

      // ── Delete tag / 删除标签 ──────────────────────────────
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const units = yield* Effect.orDie(
            database
              .select()
              .from(Unit)
              .where(and(eq(Unit.id, params.unitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!units[0]) return yield* new TagNotFound();
          yield* Effect.orDie(database.delete(Unit).where(eq(Unit.id, params.unitId)));
        }),
      )

      // ── Attach tag to unit (admin) / 将标签附加到 unit（管理员） ──
      .handle("attach", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify the tag unit exists / 验证标签 unit 存在
          const tagUnits = yield* Effect.orDie(
            database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.id, payload.tagUnitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!tagUnits[0]) return yield* new TagNotFound();

          // Insert tag vote with creation-as-vote semantics / 以创建即投票语义插入投票
          yield* Effect.orDie(
            database
              .insert(TagVote)
              .values({ userId: user.id, unitId: payload.unitId, tagUnitId: payload.tagUnitId, value: 1 })
              .onConflictDoNothing({
                target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
              }),
          );

          const agg = yield* aggregateVotes(payload.unitId, payload.tagUnitId);
          yield* upsertUnitTagRow(payload.unitId, payload.tagUnitId, agg);
        }),
      )

      // ── Detach tag from unit (admin) / 从 unit 解除标签（管理员） ──
      .handle("detach", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          // Verify the tag unit exists / 验证标签 unit 存在
          const tagUnits = yield* Effect.orDie(
            database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.id, payload.tagUnitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!tagUnits[0]) return yield* new TagNotFound();

          // Delete all votes for this pair, then delete the UnitTag / 删除此配对的所有投票，然后删除 UnitTag
          yield* Effect.orDie(
            database
              .delete(TagVote)
              .where(and(eq(TagVote.unitId, payload.unitId), eq(TagVote.tagUnitId, payload.tagUnitId))),
          );
          yield* Effect.orDie(
            database
              .delete(UnitTag)
              .where(and(eq(UnitTag.unitId, payload.unitId), eq(UnitTag.tagUnitId, payload.tagUnitId))),
          );
        }),
      )

      // ── Cast tag vote / 对标签投票 ────────────────────────
      .handle("vote", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const clampedValue = payload.value > 0 ? 1 : -1;

          yield* Effect.orDie(
            database
              .insert(TagVote)
              .values({
                userId: user.id,
                unitId: payload.unitId,
                tagUnitId: payload.tagUnitId,
                value: clampedValue,
              })
              .onConflictDoUpdate({
                target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
                set: { value: clampedValue },
              }),
          );

          const agg = yield* aggregateVotes(payload.unitId, payload.tagUnitId);
          yield* Effect.orDie(
            database
              .update(UnitTag)
              .set({ score: agg.score, voteCount: agg.voteCount, updatedAt: new Date() })
              .where(and(eq(UnitTag.unitId, payload.unitId), eq(UnitTag.tagUnitId, payload.tagUnitId))),
          );
        }),
      )

      // ── Get tags for a unit / 获取特定 unit 的标签 ──────────
      .handle("forUnit", ({ params }) =>
        Effect.gen(function* () {
          const userOption = yield* CurrentUserOption;
          const userId = Option.isSome(userOption) ? userOption.value.id : undefined;

          // Check if viewer is privileged (owner) / 检查查看者是否为所有者
          const unitRows = yield* Effect.orDie(
            database.select({ userId: Unit.userId }).from(Unit).where(eq(Unit.id, params.unitId)).limit(1),
          );
          const isPrivileged = userId !== undefined && unitRows[0]?.userId === userId;

          // Fetch UnitTag rows, optionally including below-threshold / 获取 UnitTag 行，可选包括阈值以下的
          const unitTags = yield* Effect.orDie(
            database
              .select()
              .from(UnitTag)
              .where(
                isPrivileged
                  ? eq(UnitTag.unitId, params.unitId)
                  : and(eq(UnitTag.unitId, params.unitId), gt(UnitTag.score, VISIBILITY_THRESHOLD)),
              )
              .orderBy(desc(UnitTag.pinned), asc(UnitTag.position), desc(UnitTag.score), asc(UnitTag.tagUnitId)),
          );

          // Load viewer's votes if logged in / 如果已登录则加载查看者的投票
          const viewerVotes =
            userId && unitTags.length > 0
              ? yield* Effect.orDie(
                  database
                    .select({ tagUnitId: TagVote.tagUnitId, value: TagVote.value })
                    .from(TagVote)
                    .where(
                      and(
                        eq(TagVote.userId, userId),
                        eq(TagVote.unitId, params.unitId),
                        inArray(
                          TagVote.tagUnitId,
                          unitTags.map((ut) => ut.tagUnitId),
                        ),
                      ),
                    ),
                )
              : [];
          const viewerVoteMap = new Map(viewerVotes.map((v) => [v.tagUnitId, v.value]));

          const tags = unitTags.map((ut) =>
            unitTagToEntry(ut, {
              belowVisibilityThreshold: isPrivileged && ut.score <= VISIBILITY_THRESHOLD,
              viewerVote: viewerVoteMap.get(ut.tagUnitId) ?? null,
            }),
          );
          return { tags };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// UnitTagHandlers (UnitTagGroup) / UnitTag 处理器
// ---------------------------------------------------------------------------

export const UnitTagHandlers = HttpApiBuilder.group(
  Api,
  "unitTags",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Shared: aggregate tag votes / 聚合标签投票
    const aggregateVotes = (unitId: string, tagUnitId: string) =>
      Effect.gen(function* () {
        const agg = yield* Effect.orDie(
          database
            .select({
              score: sql<number>`coalesce(sum(${TagVote.value}), 0)`,
              voteCount: count(TagVote.value),
            })
            .from(TagVote)
            .where(and(eq(TagVote.unitId, unitId), eq(TagVote.tagUnitId, tagUnitId))),
        );
        return { score: Number(agg[0]?.score ?? 0), voteCount: Number(agg[0]?.voteCount ?? 0) };
      });

    // Shared: upsert UnitTag / upsert UnitTag
    const upsertRow = (unitId: string, tagUnitId: string, agg: { score: number; voteCount: number }) =>
      Effect.gen(function* () {
        const rows = yield* Effect.orDie(
          database
            .insert(UnitTag)
            .values({ unitId, tagUnitId, score: agg.score, voteCount: agg.voteCount, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: [UnitTag.unitId, UnitTag.tagUnitId],
              set: { score: agg.score, voteCount: agg.voteCount, updatedAt: new Date() },
            })
            .returning(),
        );
        return rows[0]!;
      });

    return handlers
      // ── Create unit tag (creation-as-vote) / 创建 UnitTag（创建即投票） ──
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Insert voter's +1 via upsert / 通过 upsert 插入投票者的 +1
          yield* Effect.orDie(
            database
              .insert(TagVote)
              .values({ userId: user.id, unitId: payload.unitId, tagUnitId: payload.tagUnitId, value: 1 })
              .onConflictDoNothing({
                target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
              }),
          );

          // Recompute aggregates and upsert UnitTag / 重新计算聚合值并 upsert UnitTag
          const agg = yield* aggregateVotes(payload.unitId, payload.tagUnitId);
          const row = yield* upsertRow(payload.unitId, payload.tagUnitId, agg);
          return unitTagToEntry(row);
        }),
      )

      // ── Patch unit tag (pin/position) / 修改 UnitTag（置顶/排序） ──
      .handle("patch", ({ params, payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          const sets: Partial<typeof UnitTag.$inferInsert> = { updatedAt: new Date() };
          if (payload.pinned !== undefined) {
            sets.pinned = payload.pinned;
            // Unpinning clears position / 取消置顶时清除 position
            if (payload.pinned === false) sets.position = null;
          }
          if (payload.position !== undefined) sets.position = payload.position;

          const updated = yield* Effect.orDie(
            database
              .update(UnitTag)
              .set(sets)
              .where(and(eq(UnitTag.unitId, params.unitId), eq(UnitTag.tagUnitId, params.tagUnitId)))
              .returning(),
          );
          if (!updated[0]) return yield* new TagNotFound();
          return unitTagToEntry(updated[0]);
        }),
      )

      // ── Delete unit tag / 删除 UnitTag ────────────────────
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          // Delete all votes for this pair first / 先删除此配对的所有投票
          yield* Effect.orDie(
            database
              .delete(TagVote)
              .where(and(eq(TagVote.unitId, params.unitId), eq(TagVote.tagUnitId, params.tagUnitId))),
          );
          const deleted = yield* Effect.orDie(
            database
              .delete(UnitTag)
              .where(and(eq(UnitTag.unitId, params.unitId), eq(UnitTag.tagUnitId, params.tagUnitId)))
              .returning(),
          );
          if (!deleted[0]) return yield* new TagNotFound();
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// TagVoteHandlers (TagVoteGroup) / 标签投票处理器
// ---------------------------------------------------------------------------

export const TagVoteHandlers = HttpApiBuilder.group(
  Api,
  "tagVotes",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // ── Cast vote / 投票 ─────────────────────────────────
      .handle("cast", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const clampedValue = payload.value > 0 ? 1 : -1;

          yield* Effect.orDie(
            database
              .insert(TagVote)
              .values({
                userId: user.id,
                unitId: payload.unitId,
                tagUnitId: payload.tagUnitId,
                value: clampedValue,
              })
              .onConflictDoUpdate({
                target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
                set: { value: clampedValue },
              }),
          );

          // Recompute and update UnitTag aggregates / 重新计算并更新 UnitTag 聚合值
          const agg = yield* Effect.orDie(
            database
              .select({
                score: sql<number>`coalesce(sum(${TagVote.value}), 0)`,
                voteCount: count(TagVote.value),
              })
              .from(TagVote)
              .where(and(eq(TagVote.unitId, payload.unitId), eq(TagVote.tagUnitId, payload.tagUnitId))),
          );
          const score = Number(agg[0]?.score ?? 0);
          const voteCount = Number(agg[0]?.voteCount ?? 0);

          yield* Effect.orDie(
            database
              .update(UnitTag)
              .set({ score, voteCount, updatedAt: new Date() })
              .where(and(eq(UnitTag.unitId, payload.unitId), eq(UnitTag.tagUnitId, payload.tagUnitId))),
          );
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// PolicyTagHandlers (PolicyTagGroup) / 策略标签处理器
// ---------------------------------------------------------------------------

export const PolicyTagHandlers = HttpApiBuilder.group(
  Api,
  "policyTags",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    return handlers
      // ── List policy tag rules / 列出策略标签规则 ────────────
      .handle("listRules", ({ query }) =>
        Effect.gen(function* () {
          const filters: ReturnType<typeof eq>[] = [];
          if (query.scopeKind) filters.push(eq(PolicyTagRule.scopeKind, query.scopeKind));
          if (query.realmUnitId) filters.push(eq(PolicyTagRule.realmUnitId, query.realmUnitId));
          if (query.tagUnitId) filters.push(eq(PolicyTagRule.tagUnitId, query.tagUnitId));
          if (query.state) {
            const storageState = query.state === "archived" ? "ARCHIVED" : "ACTIVE";
            filters.push(eq(PolicyTagRule.state, storageState));
          }
          const where = filters.length > 0 ? and(...filters) : undefined;

          const rows = yield* Effect.orDie(
            database
              .select()
              .from(PolicyTagRule)
              .where(where)
              .orderBy(
                asc(PolicyTagRule.scopeKind),
                asc(PolicyTagRule.realmUnitId),
                asc(PolicyTagRule.tagUnitId),
                asc(PolicyTagRule.createdAt),
              )
              .limit(lim(query.limit))
              .offset(query.offset ?? 0),
          );
          const totalAgg = yield* Effect.orDie(database.select({ total: count() }).from(PolicyTagRule).where(where));

          return new PolicyTagRuleListResult({
            rules: rows.map((r) => policyRuleToEntry(r)),
            total: totalAgg[0]?.total ?? 0,
          });
        }),
      )

      // ── Create policy tag rule / 创建策略标签规则 ───────────
      .handle("createRule", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Validate scope / 校验作用域
          if (payload.scope.kind === "realm" && !payload.scope.realmUnitId) {
            return yield* new TagForbidden();
          }

          // Verify tag unit exists / 验证标签 unit 存在
          const tagUnits = yield* Effect.orDie(
            database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.id, payload.tagUnitId), eq(Unit.type, "TAG")))
              .limit(1),
          );
          if (!tagUnits[0]) return yield* new TagForbidden();

          const rows = yield* Effect.orDie(
            database
              .insert(PolicyTagRule)
              .values({
                scopeKind: payload.scope.kind,
                realmUnitId: payload.scope.kind === "realm" ? (payload.scope.realmUnitId ?? null) : null,
                tagUnitId: payload.tagUnitId,
                createdByUserId: user.id,
                updatedByUserId: user.id,
                reason: payload.reason ?? null,
                updatedAt: new Date(),
              })
              .returning(),
          );
          if (!rows[0]) return yield* new TagConflict();
          return policyRuleToEntry(rows[0]);
        }),
      )

      // ── Update policy tag rule / 更新策略标签规则 ───────────
      .handle("updateRule", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          const sets: Partial<typeof PolicyTagRule.$inferInsert> = {
            updatedByUserId: user.id,
            updatedAt: new Date(),
          };
          if (payload.state !== undefined) {
            sets.state = payload.state === "archived" ? "ARCHIVED" : "ACTIVE";
          }
          if (payload.reason !== undefined) {
            sets.reason = payload.reason ?? null;
          }

          const updated = yield* Effect.orDie(
            database.update(PolicyTagRule).set(sets).where(eq(PolicyTagRule.id, params.ruleId)).returning(),
          );
          if (!updated[0]) return yield* new TagNotFound();
          return policyRuleToEntry(updated[0]);
        }),
      )

      // ── List policy tag applications / 列出策略标签应用 ─────
      .handle("listApplications", ({ query }) =>
        Effect.gen(function* () {
          const filters: ReturnType<typeof eq>[] = [];
          if (query.ruleId) filters.push(eq(PolicyTagApplication.ruleId, query.ruleId));
          if (query.unitId) filters.push(eq(PolicyTagApplication.unitId, query.unitId));
          const where = filters.length > 0 ? and(...filters) : undefined;

          const rows = yield* Effect.orDie(
            database
              .select()
              .from(PolicyTagApplication)
              .where(where)
              .orderBy(
                asc(PolicyTagApplication.ruleId),
                asc(PolicyTagApplication.position),
                asc(PolicyTagApplication.createdAt),
                asc(PolicyTagApplication.unitId),
              )
              .limit(lim(query.limit))
              .offset(query.offset ?? 0),
          );
          const totalAgg = yield* Effect.orDie(
            database.select({ total: count() }).from(PolicyTagApplication).where(where),
          );

          return new PolicyTagApplicationListResult({
            applications: rows.map((r) => policyApplicationToEntry(r)),
            total: totalAgg[0]?.total ?? 0,
          });
        }),
      )

      // ── Create/upsert policy tag application / 创建/更新策略标签应用 ──
      .handle("createApplication", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify rule exists and is ACTIVE / 验证规则存在且为 ACTIVE 状态
          const rules = yield* Effect.orDie(
            database.select().from(PolicyTagRule).where(eq(PolicyTagRule.id, params.ruleId)).limit(1),
          );
          if (!rules[0]) return yield* new TagNotFound();
          if (rules[0].state !== "ACTIVE") return yield* new TagConflict();

          const rows = yield* Effect.orDie(
            database
              .insert(PolicyTagApplication)
              .values({
                ruleId: params.ruleId,
                unitId: payload.unitId,
                position: (payload.position as string | undefined) ?? null,
                metadata: payload.metadata ?? null,
                appliedByUserId: user.id,
                updatedByUserId: user.id,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [PolicyTagApplication.ruleId, PolicyTagApplication.unitId],
                set: {
                  position: (payload.position as string | undefined) ?? null,
                  metadata: payload.metadata ?? null,
                  updatedByUserId: user.id,
                  updatedAt: new Date(),
                },
              })
              .returning(),
          );
          if (!rows[0]) return yield* new TagNotFound();
          return policyApplicationToEntry(rows[0]);
        }),
      )

      // ── Patch policy tag application / 修补策略标签应用 ──────
      .handle("patchApplication", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify rule exists and is ACTIVE / 验证规则存在且为 ACTIVE 状态
          const rules = yield* Effect.orDie(
            database.select().from(PolicyTagRule).where(eq(PolicyTagRule.id, params.ruleId)).limit(1),
          );
          if (!rules[0]) return yield* new TagNotFound();
          if (rules[0].state !== "ACTIVE") return yield* new TagForbidden();

          const sets: Partial<typeof PolicyTagApplication.$inferInsert> = {
            updatedByUserId: user.id,
            updatedAt: new Date(),
          };
          if (payload.position !== undefined) sets.position = payload.position ?? null;
          if (payload.metadata !== undefined) sets.metadata = payload.metadata ?? null;

          const updated = yield* Effect.orDie(
            database
              .update(PolicyTagApplication)
              .set(sets)
              .where(
                and(
                  eq(PolicyTagApplication.ruleId, params.ruleId),
                  eq(PolicyTagApplication.unitId, params.unitId),
                ),
              )
              .returning(),
          );
          if (!updated[0]) return yield* new TagNotFound();
          return policyApplicationToEntry(updated[0]);
        }),
      )

      // ── Delete policy tag application / 删除策略标签应用 ────
      .handle("deleteApplication", ({ params }) =>
        Effect.gen(function* () {
          yield* CurrentUser;

          const deleted = yield* Effect.orDie(
            database
              .delete(PolicyTagApplication)
              .where(
                and(
                  eq(PolicyTagApplication.ruleId, params.ruleId),
                  eq(PolicyTagApplication.unitId, params.unitId),
                ),
              )
              .returning(),
          );
          if (!deleted[0]) return yield* new TagNotFound();
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// UserTagApplicationHandlers (UserTagApplicationGroup) / 用户标签应用处理器
// ---------------------------------------------------------------------------

export const UserTagApplicationHandlers = HttpApiBuilder.group(
  Api,
  "userTagApplications",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    // Shared: list user tag applications for a given user+unit / 列出给定用户+unit 的用户标签应用
    const listForUnit = (userId: string, unitId: string) =>
      Effect.orDie(
        database
          .select()
          .from(UserTagApplication)
          .where(and(eq(UserTagApplication.userId, userId), eq(UserTagApplication.unitId, unitId)))
          .orderBy(asc(UserTagApplication.position), asc(UserTagApplication.tagUnitId)),
      );

    return handlers
      // ── List visible user tags for a user+unit / 列出用户+unit 的可见用户标签 ──
      .handle("listForUserUnit", ({ params }) =>
        Effect.gen(function* () {
          // Visibility checks simplified for new backend / 新后端中简化了可见性检查
          yield* CurrentUserOption;
          const rows = yield* listForUnit(params.userId, params.unitId);
          return rows.map((r) => userTagAppToEntry(r));
        }),
      )

      // ── List my tags for a unit / 列出我对某个 unit 的标签 ──
      .handle("listMine", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* listForUnit(user.id, params.unitId);
          return rows.map((r) => userTagAppToEntry(r));
        }),
      )

      // ── Replace my tags for a unit / 替换我对某个 unit 的标签 ──
      .handle("set", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Delete existing, then insert new tags / 删除现有的，然后插入新标签
          yield* Effect.orDie(
            database
              .delete(UserTagApplication)
              .where(
                and(eq(UserTagApplication.userId, user.id), eq(UserTagApplication.unitId, params.unitId)),
              ),
          );

          const uniqueTagIds = [...new Set(payload.tagUnitIds.map((id) => id.trim()).filter(Boolean))];
          if (uniqueTagIds.length > 0) {
            yield* Effect.orDie(
              database.insert(UserTagApplication).values(
                uniqueTagIds.map((tagUnitId, index) => ({
                  userId: user.id,
                  unitId: params.unitId,
                  tagUnitId,
                  position: String(index).padStart(8, "0"),
                  updatedAt: new Date(),
                })),
              ),
            );
          }

          const rows = yield* listForUnit(user.id, params.unitId);
          return rows.map((r) => userTagAppToEntry(r));
        }),
      )

      // ── Reorder one user tag application / 重新排序一个用户标签应用 ──
      .handle("reorder", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Look up before/after positions for fractional index generation
          // 查找前后位置以生成分数索引
          const getPosition = (tagUnitId: string | null | undefined) => {
            if (!tagUnitId) return Effect.succeed(null as string | null);
            return Effect.map(
              Effect.orDie(
                database
                  .select({ position: UserTagApplication.position })
                  .from(UserTagApplication)
                  .where(
                    and(
                      eq(UserTagApplication.userId, user.id),
                      eq(UserTagApplication.unitId, params.unitId),
                      eq(UserTagApplication.tagUnitId, tagUnitId),
                    ),
                  )
                  .limit(1),
              ),
              (rows) => rows[0]?.position ?? null,
            );
          };

          const beforePos = yield* getPosition(payload.beforeTagUnitId);
          const afterPos = yield* getPosition(payload.afterTagUnitId);

          // Simple midpoint position calculation / 简单的中点位置计算
          const position = (() => {
            if (beforePos && afterPos) {
              return beforePos < afterPos ? beforePos + "V" : afterPos + "V";
            }
            if (beforePos) return beforePos + "V";
            if (afterPos) {
              const code = afterPos.charCodeAt(0);
              return code > 48 ? String.fromCharCode(code - 1) + afterPos.slice(1) : afterPos.slice(0, -1) + "A";
            }
            return "V";
          })();

          const updated = yield* Effect.orDie(
            database
              .update(UserTagApplication)
              .set({ position, updatedAt: new Date() })
              .where(
                and(
                  eq(UserTagApplication.userId, user.id),
                  eq(UserTagApplication.unitId, params.unitId),
                  eq(UserTagApplication.tagUnitId, params.tagUnitId),
                ),
              )
              .returning(),
          );
          if (!updated[0]) return yield* new TagNotFound();
          return userTagAppToEntry(updated[0]);
        }),
      )

      // ── Delete one user tag application / 删除一个用户标签应用 ──
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* Effect.orDie(
            database
              .delete(UserTagApplication)
              .where(
                and(
                  eq(UserTagApplication.userId, user.id),
                  eq(UserTagApplication.unitId, params.unitId),
                  eq(UserTagApplication.tagUnitId, params.tagUnitId),
                ),
              ),
          );
        }),
      );
  }),
);
