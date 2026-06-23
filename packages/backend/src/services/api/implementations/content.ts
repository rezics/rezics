import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, desc, eq, inArray } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  ContentStructure as ContentStructureTable,
  ContentStructureNode,
  ContentTranslation as ContentTranslationTable,
  HistoryOutbox,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  User,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  ContentConflict,
  ContentForbidden,
  ContentNotFound,
  ContentStructure as ContentStructureDTO,
  ContentTranslation as ContentTranslationDTO,
  HistoryComparison,
  HistoryRevisionEntry,
  HistoryStructureEvent,
  ResolvedActor,
  ResolvedUnit,
} from "../interfaces/content.ts";

// ---------------------------------------------------------------------------
// Types / 类型
// ---------------------------------------------------------------------------

type ContentStructureNodeRow = typeof ContentStructureNode.$inferSelect;

type PlannedNode = {
  id: string;
  parentId: string | null;
  position: string;
  title: string;
  noContent: boolean;
  rating: ContentStructureNodeRow["rating"];
  contentUnitId: string | null;
};

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

/**
 * Build a nested tree from flat ContentStructureNode rows.
 * 从扁平的 ContentStructureNode 行构建嵌套树。
 */
function buildStructureTree(rows: ContentStructureNodeRow[]): unknown {
  const childrenByParent = new Map<string | null, ContentStructureNodeRow[]>();
  for (const row of rows) {
    const bucket = childrenByParent.get(row.parentId) ?? [];
    bucket.push(row);
    childrenByParent.set(row.parentId, bucket);
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }

  function rowToNode(row: ContentStructureNodeRow): unknown {
    const item: Record<string, unknown> = {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    };
    if (row.contentUnitId) item["contentUnitId"] = row.contentUnitId;
    if (row.noContent) item["noContent"] = row.noContent;
    if (row.rating) item["rating"] = row.rating;
    const children = childrenByParent.get(row.id);
    if (children && children.length > 0) {
      item["children"] = children.map(rowToNode);
    }
    return item;
  }

  return (childrenByParent.get(null) ?? []).map(rowToNode);
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const ContentHandlers = HttpApiBuilder.group(
  Api,
  "content",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) =>
      Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    /**
     * Shared reload helper: fetch content structure container + active nodes.
     * 共享重载辅助：获取内容结构容器和活跃节点。
     */
    const reloadStructure = (ownerUnitId: string) =>
      Effect.gen(function* () {
        const containers = yield* database
          .select()
          .from(ContentStructureTable)
          .where(eq(ContentStructureTable.ownerUnitId, ownerUnitId));
        if (!containers[0]) return yield* new ContentNotFound();
        const nodes = yield* database
          .select()
          .from(ContentStructureNode)
          .where(
            and(
              eq(ContentStructureNode.ownerUnitId, ownerUnitId),
              eq(ContentStructureNode.isDeleted, false),
            ),
          )
          .orderBy(
            ContentStructureNode.parentId,
            ContentStructureNode.position,
          );
        return new ContentStructureDTO({
          ownerUnitId: containers[0].ownerUnitId,
          tree: buildStructureTree(nodes),
          updatedAt: containers[0].updatedAt,
        });
      });

    return (
      handlers
        // ── Get content structure / 获取内容结构 ────────────────────
        .handle("getStructure", ({ params }) =>
          reloadStructure(params.ownerUnitId).pipe(Effect.orDie),
        )

        // ── Put content structure / 更新内容结构 ───────────────────
        .handle("putStructure", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;

            // Verify the owner unit exists and the user has permission
            // 验证所有者 unit 存在且用户有权限
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.ownerUnitId));
            if (!units[0]) return yield* new ContentNotFound();
            if (units[0].userId !== user.id)
              return yield* new ContentForbidden();

            // Ensure the content structure container exists (upsert)
            // 确保内容结构容器存在（upsert）
            yield* database
              .insert(ContentStructureTable)
              .values({
                ownerUnitId: params.ownerUnitId,
                updatedAt: new Date(),
              })
              .onConflictDoNothing();

            const submittedTree = payload.tree;
            if (!Array.isArray(submittedTree))
              return yield* new ContentConflict();

            // Fetch all existing nodes for this owner (including deleted)
            // 获取此所有者的所有现有节点（包括已删除的）
            const allExisting = yield* database
              .select()
              .from(ContentStructureNode)
              .where(eq(ContentStructureNode.ownerUnitId, params.ownerUnitId))
              .orderBy(
                ContentStructureNode.parentId,
                ContentStructureNode.position,
              );
            const existingActive = allExisting.filter((r) => !r.isDeleted);
            const deletedById = new Map(
              allExisting.filter((r) => r.isDeleted).map((r) => [r.id, r]),
            );

            // Plan submitted tree into flat node list
            // 将提交的树规划为扁平节点列表
            const planned = flattenSubmittedTree(
              submittedTree,
              null,
              existingActive,
              deletedById,
            );
            const submittedIds = new Set(planned.map((p) => p.id));

            // Soft-delete nodes removed from the tree
            // 软删除从树中移除的节点
            const removedIds = existingActive
              .map((r) => r.id)
              .filter((id) => !submittedIds.has(id));
            if (removedIds.length > 0) {
              // Promote children of removed nodes to root
              // 将已移除节点的子节点提升到根级
              yield* database
                .update(ContentStructureNode)
                .set({ parentId: null, updatedAt: new Date() })
                .where(
                  and(
                    eq(ContentStructureNode.ownerUnitId, params.ownerUnitId),
                    eq(ContentStructureNode.isDeleted, false),
                    inArray(ContentStructureNode.parentId, removedIds),
                  ),
                );
              yield* database
                .update(ContentStructureNode)
                .set({
                  isDeleted: true,
                  deletedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(ContentStructureNode.ownerUnitId, params.ownerUnitId),
                    inArray(ContentStructureNode.id, removedIds),
                  ),
                );
            }

            // Upsert planned nodes
            // 更新或插入规划的节点
            const existingById = new Map(existingActive.map((r) => [r.id, r]));
            for (const plan of planned) {
              const existing = existingById.get(plan.id);
              if (!existing) {
                yield* database.insert(ContentStructureNode).values({
                  id: plan.id,
                  ownerUnitId: params.ownerUnitId,
                  parentId: plan.parentId,
                  position: plan.position,
                  contentUnitId: plan.contentUnitId ?? undefined,
                  title: plan.title,
                  noContent: plan.noContent,
                  rating: plan.rating ?? undefined,
                  updatedAt: new Date(),
                });
                continue;
              }
              if (
                existing.parentId !== plan.parentId ||
                existing.position !== plan.position ||
                (existing.contentUnitId ?? null) !==
                  (plan.contentUnitId ?? null) ||
                existing.title !== plan.title ||
                existing.noContent !== plan.noContent ||
                (existing.rating ?? null) !== (plan.rating ?? null)
              ) {
                yield* database
                  .update(ContentStructureNode)
                  .set({
                    parentId: plan.parentId,
                    position: plan.position,
                    contentUnitId: plan.contentUnitId ?? null,
                    title: plan.title,
                    noContent: plan.noContent,
                    rating: plan.rating ?? null,
                    updatedAt: new Date(),
                  })
                  .where(eq(ContentStructureNode.id, plan.id));
              }
            }

            // Bump container timestamp
            // 更新容器时间戳
            yield* database
              .update(ContentStructureTable)
              .set({ updatedAt: new Date() })
              .where(eq(ContentStructureTable.ownerUnitId, params.ownerUnitId));

            return yield* reloadStructure(params.ownerUnitId);
          }).pipe(Effect.orDie),
        )

        // ── Restore soft-deleted nodes / 恢复软删除的节点 ──────────
        .handle("restoreStructure", ({ params }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;

            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.ownerUnitId));
            if (!units[0]) return yield* new ContentNotFound();
            if (units[0].userId !== user.id)
              return yield* new ContentForbidden();

            // Find all soft-deleted nodes for this owner
            // 查找此所有者的所有软删除节点
            const deletedNodes = yield* database
              .select()
              .from(ContentStructureNode)
              .where(
                and(
                  eq(ContentStructureNode.ownerUnitId, params.ownerUnitId),
                  eq(ContentStructureNode.isDeleted, true),
                ),
              );

            if (deletedNodes.length > 0) {
              // Check which parents are still alive; if parent is deleted, reparent to root
              // 检查哪些父级仍然存活；如果父级已删除，则重新设置为根级
              const activeNodes = yield* database
                .select()
                .from(ContentStructureNode)
                .where(
                  and(
                    eq(ContentStructureNode.ownerUnitId, params.ownerUnitId),
                    eq(ContentStructureNode.isDeleted, false),
                  ),
                );
              const activeIds = new Set(activeNodes.map((n) => n.id));

              for (const node of deletedNodes) {
                const parentIsAlive =
                  node.parentId === null || activeIds.has(node.parentId);
                const restoredParentId = parentIsAlive ? node.parentId : null;
                yield* database
                  .update(ContentStructureNode)
                  .set({
                    isDeleted: false,
                    deletedAt: null,
                    parentId: restoredParentId,
                    updatedAt: new Date(),
                  })
                  .where(eq(ContentStructureNode.id, node.id));
                // After restoring, this node becomes active for subsequent checks
                // 恢复后，此节点对于后续检查变为活跃状态
                activeIds.add(node.id);
              }

              // Bump container timestamp
              // 更新容器时间戳
              yield* database
                .update(ContentStructureTable)
                .set({ updatedAt: new Date() })
                .where(
                  eq(ContentStructureTable.ownerUnitId, params.ownerUnitId),
                );
            }

            return yield* reloadStructure(params.ownerUnitId);
          }).pipe(Effect.orDie),
        )

        // ── Get content translation / 获取内容翻译 ─────────────────
        .handle("getTranslation", ({ params }) =>
          Effect.gen(function* () {
            const rows = yield* database
              .select()
              .from(ContentTranslationTable)
              .where(
                and(
                  eq(ContentTranslationTable.unitId, params.unitId),
                  eq(ContentTranslationTable.language, params.language),
                ),
              )
              .limit(1);
            if (!rows[0]) return yield* new ContentNotFound();

            return new ContentTranslationDTO({
              unitId: rows[0].unitId,
              language: rows[0].language,
              body: rows[0].content,
              updatedAt: rows[0].updatedAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── Put content translation / 更新内容翻译 ─────────────────
        .handle("putTranslation", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;

            // Verify the unit exists and user has permission
            // 验证 unit 存在且用户有权限
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();
            if (units[0].userId !== user.id)
              return yield* new ContentForbidden();

            const now = new Date();

            // Upsert the content translation
            // 更新或插入内容翻译
            const upserted = yield* database
              .insert(ContentTranslationTable)
              .values({
                unitId: params.unitId,
                language: params.language,
                content: payload.body,
                status: "PUBLISHED",
                authorUserId: user.id,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [
                  ContentTranslationTable.unitId,
                  ContentTranslationTable.language,
                ],
                set: {
                  content: payload.body,
                  authorUserId: user.id,
                  updatedAt: now,
                },
              })
              .returning();

            // Ensure the support language record exists
            // 确保支持语言记录存在
            yield* database
              .insert(UnitSupportLanguage)
              .values({
                unitId: params.unitId,
                language: params.language,
                isPrimary: false,
              })
              .onConflictDoNothing({
                target: [
                  UnitSupportLanguage.unitId,
                  UnitSupportLanguage.language,
                ],
              });

            const row = upserted[0]!;
            return new ContentTranslationDTO({
              unitId: row.unitId,
              language: row.language,
              body: row.content,
              updatedAt: row.updatedAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── Delete content translation / 删除内容翻译 ──────────────
        .handle("deleteTranslation", ({ params }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;

            // Verify the unit exists and user has permission
            // 验证 unit 存在且用户有权限
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();
            if (units[0].userId !== user.id)
              return yield* new ContentForbidden();

            // Check the translation actually exists
            // 检查翻译确实存在
            const existing = yield* database
              .select()
              .from(ContentTranslationTable)
              .where(
                and(
                  eq(ContentTranslationTable.unitId, params.unitId),
                  eq(ContentTranslationTable.language, params.language),
                ),
              )
              .limit(1);
            if (!existing[0]) return yield* new ContentNotFound();

            yield* database
              .delete(ContentTranslationTable)
              .where(
                and(
                  eq(ContentTranslationTable.unitId, params.unitId),
                  eq(ContentTranslationTable.language, params.language),
                ),
              );
          }).pipe(Effect.orDie),
        )

        // ── List revisions (from HistoryOutbox) / 列出修订记录 ─────
        .handle("listRevisions", ({ params, query }) =>
          Effect.gen(function* () {
            // Verify the unit exists
            // 验证 unit 存在
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();

            const rows = yield* database
              .select()
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.unitId, params.unitId))
              .orderBy(desc(HistoryOutbox.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new HistoryRevisionEntry({
                  id: r.id,
                  unitId: r.unitId,
                  actorId: r.actorUserId,
                  action: r.category,
                  timestamp: r.createdAt,
                  meta: r.payload ?? undefined,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── Compare revisions / 比较修订 ──────────────────────────
        .handle("compareRevisions", ({ params, query }) =>
          Effect.gen(function* () {
            // Verify the unit exists
            // 验证 unit 存在
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();

            // Fetch both revisions by ID
            // 通过 ID 获取两个修订
            const fromRows = yield* database
              .select()
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.id, query.from))
              .limit(1);
            const toRows = yield* database
              .select()
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.id, query.to))
              .limit(1);
            if (!fromRows[0] || !toRows[0]) return yield* new ContentNotFound();

            return new HistoryComparison({
              before: fromRows[0].payload,
              after: toRows[0].payload,
              diff: {
                from: fromRows[0].id,
                to: toRows[0].id,
                fromSequence: fromRows[0].sequence,
                toSequence: toRows[0].sequence,
              },
            });
          }).pipe(Effect.orDie),
        )

        // ── Get single revision / 获取单条修订 ─────────────────────
        .handle("getRevision", ({ params }) =>
          Effect.gen(function* () {
            // Verify the unit exists
            // 验证 unit 存在
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();

            const rows = yield* database
              .select()
              .from(HistoryOutbox)
              .where(
                and(
                  eq(HistoryOutbox.unitId, params.unitId),
                  eq(HistoryOutbox.id, params.revisionId),
                ),
              )
              .limit(1);
            if (!rows[0]) return yield* new ContentNotFound();

            return new HistoryRevisionEntry({
              id: rows[0].id,
              unitId: rows[0].unitId,
              actorId: rows[0].actorUserId,
              action: rows[0].category,
              timestamp: rows[0].createdAt,
              meta: rows[0].payload ?? undefined,
            });
          }).pipe(Effect.orDie),
        )

        // ── List structure events / 列出结构事件 ───────────────────
        .handle("listStructureEvents", ({ params, query }) =>
          Effect.gen(function* () {
            // Verify the unit exists
            // 验证 unit 存在
            const units = yield* database
              .select()
              .from(Unit)
              .where(eq(Unit.id, params.unitId));
            if (!units[0]) return yield* new ContentNotFound();

            // Structure events are HistoryOutbox rows with structure-related categories
            // 结构事件是具有结构相关类别的 HistoryOutbox 行
            const rows = yield* database
              .select()
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.unitId, params.unitId))
              .orderBy(desc(HistoryOutbox.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new HistoryStructureEvent({
                  id: r.id,
                  unitId: r.unitId,
                  action: r.category,
                  timestamp: r.createdAt,
                  meta: r.payload ?? undefined,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── Resolve actors / 解析操作者 ────────────────────────────
        .handle("resolveActors", ({ payload }) =>
          Effect.gen(function* () {
            const ids = uniqueIds(payload.ids);
            if (ids.length === 0) return [];

            const users = yield* database
              .select({
                unitId: User.unitId,
                name: User.name,
                avatar: User.avatar,
              })
              .from(User)
              .where(inArray(User.unitId, ids));

            return users.map(
              (u) =>
                new ResolvedActor({
                  id: u.unitId,
                  name: u.name ?? u.unitId,
                  image: u.avatar ?? null,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── Resolve units / 解析 Unit 引用 ─────────────────────────
        .handle("resolveUnits", ({ payload }) =>
          Effect.gen(function* () {
            const ids = uniqueIds(payload.ids);
            if (ids.length === 0) return [];

            const unitRows = yield* database
              .select({
                id: Unit.id,
                type: Unit.type,
                slug: Unit.slug,
                defaultLanguage: Unit.defaultLanguage,
              })
              .from(Unit)
              .where(inArray(Unit.id, ids));

            if (unitRows.length === 0) return [];

            // Fetch translations for titles
            // 获取翻译以获得标题
            const unitIds = unitRows.map((r) => r.id);
            const translations = yield* database
              .select({
                unitId: UnitTranslation.unitId,
                title: UnitTranslation.title,
                language: UnitTranslation.language,
              })
              .from(UnitTranslation)
              .where(inArray(UnitTranslation.unitId, unitIds));
            const titleByUnitId = new Map<string, string>();
            for (const t of translations) {
              // Prefer first translation found (stable order)
              // 优先使用找到的第一个翻译（稳定顺序）
              if (!titleByUnitId.has(t.unitId) && t.title) {
                titleByUnitId.set(t.unitId, t.title);
              }
            }

            return unitRows.map(
              (r) =>
                new ResolvedUnit({
                  id: r.id,
                  title: titleByUnitId.get(r.id) ?? r.slug ?? r.id,
                  kind: r.type,
                }),
            );
          }).pipe(Effect.orDie),
        )
    );
  }),
);

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------

/**
 * Type-guard: is the value a non-null, non-array object suitable for property access?
 * 类型守卫：值是否为非 null、非数组的对象，可安全访问属性？
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deduplicate and cap a list of IDs (max 100).
 * 去重并限制 ID 列表（最多 100 个）。
 */
function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
}

/**
 * Flatten a submitted tree structure into a list of planned nodes with positions.
 * 将提交的树结构展平为带有位置信息的规划节点列表。
 */
function flattenSubmittedTree(
  siblings: readonly unknown[],
  parentId: string | null,
  existingActive: readonly ContentStructureNodeRow[],
  deletedById: ReadonlyMap<string, ContentStructureNodeRow>,
): PlannedNode[] {
  const existingById = new Map(existingActive.map((r) => [r.id, r]));
  const out: PlannedNode[] = [];

  for (const [i, raw] of siblings.entries()) {
    if (!isRecord(raw)) continue;

    const rawId = raw["id"];
    const nodeId =
      typeof rawId === "string" && rawId ? rawId : crypto.randomUUID();

    // Reject resurrected (deleted) IDs
    // 拒绝复活（已删除的）ID
    if (deletedById.has(nodeId)) continue;

    // Assign position: use existing position if available and valid, otherwise generate
    // 分配位置：如果存在且有效则使用现有位置，否则生成
    const existing = existingById.get(nodeId);
    const position =
      existing?.parentId === parentId ? existing.position : generatePosition(i);

    const rawTitle = raw["title"];
    const rawRating = raw["rating"];
    const rawContentUnitId = raw["contentUnitId"];

    out.push({
      id: nodeId,
      parentId,
      position,
      title: typeof rawTitle === "string" ? rawTitle : "",
      noContent: raw["noContent"] === true,
      rating: isValidRating(rawRating) ? rawRating : null,
      contentUnitId:
        typeof rawContentUnitId === "string" ? rawContentUnitId : null,
    });

    const children = raw["children"];
    if (Array.isArray(children) && children.length > 0) {
      out.push(
        ...flattenSubmittedTree(children, nodeId, existingActive, deletedById),
      );
    }
  }

  return out;
}

const VALID_RATINGS = new Set(["GENERAL", "R_15", "R_18", "R_18G"]);

/**
 * Type-guard for ContentRating enum values.
 * ContentRating 枚举值的类型守卫。
 */
function isValidRating(
  value: unknown,
): value is ContentStructureNodeRow["rating"] {
  return typeof value === "string" && VALID_RATINGS.has(value);
}

/**
 * Generate a simple fractional-indexing-compatible position string from an index.
 * 从索引生成一个简单的兼容 fractional indexing 的位置字符串。
 */
function generatePosition(index: number): string {
  // Use a padded string to maintain lexicographic ordering
  // 使用填充字符串保持字典序排序
  return String.fromCharCode(86 + index); // Start from 'V' (ASCII 86)
}
