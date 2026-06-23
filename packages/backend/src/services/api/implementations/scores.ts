import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { Database } from "../../database/index.ts";
import { Post, ScoreAggregate, ScoreEntry, ScoreRealmField, Unit, User } from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  ScoreAggregateResult,
  ScoreConflict,
  ScoreEntryResult,
  ScoreForbidden,
  ScoreNotFound,
  ScoreRealmFieldResult,
} from "../interfaces/scores.ts";

// ---------------------------------------------------------------------------
// Constants / 常量
// ---------------------------------------------------------------------------

const SCORE_MIN = 1;
const SCORE_MAX = 10;

// ---------------------------------------------------------------------------
// Types / 类型
// ---------------------------------------------------------------------------

type Distribution = Record<string, number>;

interface FieldAggregate {
  total: number;
  count: number;
  dist: Distribution;
}

type FieldsAggregate = Record<string, FieldAggregate>;

// ---------------------------------------------------------------------------
// Validation / 校验
// ---------------------------------------------------------------------------

function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= SCORE_MIN && value <= SCORE_MAX;
}

// ---------------------------------------------------------------------------
// Aggregate delta helpers / 聚合增量辅助函数
// ---------------------------------------------------------------------------

function applyDistributionDelta(
  dist: Distribution,
  oldValue: number | null,
  newValue: number | null,
): Distribution {
  const result = { ...dist };
  if (oldValue !== null) {
    const key = String(oldValue);
    result[key] = (result[key] ?? 0) - 1;
    if (result[key]! <= 0) delete result[key];
  }
  if (newValue !== null) {
    const key = String(newValue);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function applyFieldsDelta(
  currentFields: FieldsAggregate | null,
  oldEntryFields: Record<string, number> | null,
  newEntryFields: Record<string, number> | null,
): FieldsAggregate | null {
  const result: FieldsAggregate = currentFields ? { ...currentFields } : {};

  const allKeys = new Set<string>([
    ...Object.keys(oldEntryFields ?? {}),
    ...Object.keys(newEntryFields ?? {}),
  ]);

  if (allKeys.size === 0) return currentFields;

  for (const key of allKeys) {
    const oldVal = oldEntryFields?.[key] ?? null;
    const newVal = newEntryFields?.[key] ?? null;

    if (oldVal === null && newVal === null) continue;

    const current: FieldAggregate = result[key]
      ? { ...result[key], dist: { ...result[key].dist } }
      : { total: 0, count: 0, dist: {} };

    const mutable = { total: current.total, count: current.count, dist: current.dist };

    if (oldVal !== null) {
      mutable.total -= oldVal;
      mutable.count -= 1;
      const distKey = String(oldVal);
      mutable.dist[distKey] = (mutable.dist[distKey] ?? 0) - 1;
      if (mutable.dist[distKey]! <= 0) delete mutable.dist[distKey];
    }

    if (newVal !== null) {
      mutable.total += newVal;
      mutable.count += 1;
      const distKey = String(newVal);
      mutable.dist[distKey] = (mutable.dist[distKey] ?? 0) + 1;
    }

    if (mutable.count <= 0) {
      delete result[key];
    } else {
      result[key] = mutable;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function computeAggregateFromEntries(entries: (typeof ScoreEntry.$inferSelect)[]): {
  totalScore: number;
  totalCount: number;
  distribution: Distribution;
  fields: FieldsAggregate | null;
} {
  const totalCount = entries.length;
  const distribution: Distribution = {};
  const fields: FieldsAggregate = {};
  const totalScore = entries.reduce((sum, entry) => sum + entry.value, 0);

  for (const entry of entries) {
    const distKey = String(entry.value);
    distribution[distKey] = (distribution[distKey] ?? 0) + 1;

    const entryFields = entry.fields as Record<string, number> | null;
    if (entryFields) {
      for (const [key, val] of Object.entries(entryFields)) {
        if (!fields[key]) {
          fields[key] = { total: 0, count: 0, dist: {} };
        }
        fields[key].total += val;
        fields[key].count += 1;
        const fDistKey = String(val);
        fields[key].dist[fDistKey] = (fields[key].dist[fDistKey] ?? 0) + 1;
      }
    }
  }

  return {
    totalScore,
    totalCount,
    distribution,
    fields: Object.keys(fields).length > 0 ? fields : null,
  };
}

// ---------------------------------------------------------------------------
// Fractional indexing (minimal inline) / 分数索引（内联最小实现）
// ---------------------------------------------------------------------------

const FI_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const FI_BASE = FI_ALPHABET.length;
const FI_MID = FI_ALPHABET[Math.floor(FI_BASE / 2)]!;

function fiCharIndex(c: string): number {
  const i = FI_ALPHABET.indexOf(c);
  if (i < 0) throw new Error(`invalid position character: ${c}`);
  return i;
}

function fiKeyAfter(a: string): string {
  const lastChar = a[a.length - 1]!;
  const lastIdx = fiCharIndex(lastChar);
  if (lastIdx < FI_BASE - 1) {
    return a.slice(0, -1) + FI_ALPHABET[lastIdx + 1]!;
  }
  return a + FI_MID;
}

function generateAfter(lastPosition: string | undefined): string {
  if (lastPosition === undefined) return FI_MID;
  return fiKeyAfter(lastPosition);
}

// ---------------------------------------------------------------------------
// Mappers: dbRow → DTO / 映射函数：数据库行 → DTO
// ---------------------------------------------------------------------------

function entryToDTO(row: typeof ScoreEntry.$inferSelect): ScoreEntryResult {
  return new ScoreEntryResult({
    id: row.id,
    userId: row.userId,
    unitId: row.unitId,
    realm: row.realm,
    value: row.value,
    fields: (row.fields as Record<string, number>) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function aggregateToDTO(row: typeof ScoreAggregate.$inferSelect): ScoreAggregateResult {
  return new ScoreAggregateResult({
    unitId: row.unitId,
    realm: row.realm,
    totalScore: row.totalScore,
    totalCount: row.totalCount,
    distribution: row.distribution as Distribution,
    fields: (row.fields as FieldsAggregate) ?? null,
    updatedAt: row.updatedAt,
  });
}

function realmFieldToDTO(row: typeof ScoreRealmField.$inferSelect): ScoreRealmFieldResult {
  return new ScoreRealmFieldResult({
    realm: row.realm,
    key: row.key,
    label: row.label ?? null,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const ScoresHandlers = HttpApiBuilder.group(
  Api,
  "scores",
  Effect.fn(function* (handlers) {
    const db = yield* Database;

    // Aggregate update helper (captures db from scope) / 聚合更新辅助函数（从作用域捕获 db）
    const doUpdateAggregate = (
      unitId: string,
      realm: string,
      oldValue: number | null,
      newValue: number | null,
      oldFields: Record<string, number> | null,
      newFields: Record<string, number> | null,
    ) =>
      Effect.gen(function* () {
        const existing = yield* Effect.orDie(
          db
            .select()
            .from(ScoreAggregate)
            .where(and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm)))
            .limit(1),
        );
        const row = existing[0];

        // Deletion case: removing the last entry / 删除情形：移除最后一个条目
        if (newValue === null && row) {
          const nextCount = row.totalCount - 1;
          if (nextCount <= 0) {
            yield* Effect.orDie(
              db
                .delete(ScoreAggregate)
                .where(and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm))),
            );
            return;
          }

          const distribution = applyDistributionDelta(row.distribution as Distribution, oldValue, null);
          const fields = applyFieldsDelta(row.fields as FieldsAggregate | null, oldFields, null);

          yield* Effect.orDie(
            db
              .update(ScoreAggregate)
              .set({
                totalScore: row.totalScore - (oldValue ?? 0),
                totalCount: nextCount,
                distribution,
                fields: fields ?? undefined,
                updatedAt: new Date(),
              })
              .where(and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm))),
          );
          return;
        }

        // Creation case: no existing aggregate / 创建情形：尚不存在聚合
        if (!row && newValue !== null) {
          const distribution: Distribution = { [String(newValue)]: 1 };
          const fields: FieldsAggregate | null = newFields
            ? Object.fromEntries(
                Object.entries(newFields).map(([key, val]) => [
                  key,
                  { total: val, count: 1, dist: { [String(val)]: 1 } },
                ]),
              )
            : null;

          yield* Effect.orDie(
            db.insert(ScoreAggregate).values({
              unitId,
              realm,
              totalScore: newValue,
              totalCount: 1,
              distribution,
              fields: fields ?? undefined,
              updatedAt: new Date(),
            }),
          );
          return;
        }

        // Update case: existing aggregate, changing value / 更新情形：已存在聚合，变更其值
        if (row && newValue !== null) {
          const deltaScore = newValue - (oldValue ?? 0);
          const deltaCount = oldValue === null ? 1 : 0;

          const distribution = applyDistributionDelta(row.distribution as Distribution, oldValue, newValue);
          const fields = applyFieldsDelta(row.fields as FieldsAggregate | null, oldFields, newFields);

          yield* Effect.orDie(
            db
              .update(ScoreAggregate)
              .set({
                totalScore: row.totalScore + deltaScore,
                totalCount: row.totalCount + deltaCount,
                distribution,
                fields: fields ?? undefined,
                updatedAt: new Date(),
              })
              .where(and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm))),
          );
        }
      });

    return handlers
      // ── Upsert score / 写入或更新评分 ────────────────────────────
      .handle("upsert", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Validate score range / 校验评分范围
          if (!isValidScore(payload.value)) {
            return yield* Effect.die(`Score value must be an integer between ${SCORE_MIN} and ${SCORE_MAX}`);
          }

          const entryFields = (payload.fields as Record<string, number>) ?? null;
          const newFields = entryFields && Object.keys(entryFields).length > 0 ? entryFields : null;

          // Validate fields against realm field registry / 根据 realm 字段注册表校验各字段
          if (newFields) {
            const realmFields = yield* Effect.orDie(
              db
                .select({ key: ScoreRealmField.key })
                .from(ScoreRealmField)
                .where(eq(ScoreRealmField.realm, payload.realm)),
            );
            const allowedKeys = new Set(realmFields.map((f) => f.key));
            if (allowedKeys.size === 0) {
              return yield* Effect.die("Fields submitted for a realm with no registered fields");
            }
            for (const [key, val] of Object.entries(newFields)) {
              if (!allowedKeys.has(key) || !isValidScore(val)) {
                return yield* Effect.die(`Invalid field key or value: ${key}`);
              }
            }
          }

          // Look up existing entry for delta computation / 查询已有条目以计算增量
          const existingRows = yield* Effect.orDie(
            db
              .select()
              .from(ScoreEntry)
              .where(
                and(
                  eq(ScoreEntry.userId, user.id),
                  eq(ScoreEntry.unitId, payload.unitId),
                  eq(ScoreEntry.realm, payload.realm),
                ),
              )
              .limit(1),
          );
          const existing = existingRows[0];
          const oldValue = existing?.value ?? null;
          const oldFields = (existing?.fields as Record<string, number>) ?? null;

          // Upsert the score entry / 写入或更新评分条目
          const entryRows = yield* Effect.orDie(
            db
              .insert(ScoreEntry)
              .values({
                userId: user.id,
                unitId: payload.unitId,
                realm: payload.realm,
                value: payload.value,
                fields: newFields ?? undefined,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [ScoreEntry.userId, ScoreEntry.unitId, ScoreEntry.realm],
                set: {
                  value: payload.value,
                  ...(newFields ? { fields: newFields } : {}),
                  updatedAt: new Date(),
                },
              })
              .returning(),
          );
          const entry = entryRows[0]!;

          // Update the aggregate / 更新聚合
          yield* doUpdateAggregate(payload.unitId, payload.realm, oldValue, payload.value, oldFields, newFields);

          return entryToDTO(entry);
        }),
      )

      // ── Delete score / 删除评分 ────────────────────────────────
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          const rows = yield* Effect.orDie(db.select().from(ScoreEntry).where(eq(ScoreEntry.id, params.id)).limit(1));
          const entry = rows[0];
          if (!entry) return yield* new ScoreNotFound();

          // Check for linked posts (reviews/remarks) / 检查关联的 post（评论/短评）
          const linkedPosts = yield* Effect.orDie(
            db.select({ unitId: Post.unitId }).from(Post).where(eq(Post.scoreEntryId, params.id)),
          );

          if (linkedPosts.length > 0) {
            // Check if user is admin / 检查用户是否为管理员
            const userRows = yield* Effect.orDie(
              db
                .select({ permission: User.permission })
                .from(User)
                .where(eq(User.unitId, user.id))
                .limit(1),
            );
            const perm = userRows[0]?.permission as { role?: string } | null;
            const isAdmin = perm?.role === "ADMIN" || perm?.role === "ROOT";

            if (!isAdmin) return yield* new ScoreConflict();

            // Admin: delete linked posts first / 管理员：先删除关联的 post
            yield* Effect.orDie(db.delete(Post).where(eq(Post.scoreEntryId, params.id)));
            yield* Effect.orDie(
              db.delete(Unit).where(
                inArray(
                  Unit.id,
                  linkedPosts.map((p) => p.unitId),
                ),
              ),
            );
          }

          // Delete the entry / 删除条目
          yield* Effect.orDie(db.delete(ScoreEntry).where(eq(ScoreEntry.id, params.id)));

          // Update the aggregate / 更新聚合
          const oldFields = (entry.fields as Record<string, number>) ?? null;
          yield* doUpdateAggregate(entry.unitId, entry.realm, entry.value, null, oldFields, null);
        }),
      )

      // ── Aggregates by unit / 某个 unit 的所有 realm 聚合数据 ────
      .handle("aggregatesByUnit", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* Effect.orDie(
            db.select().from(ScoreAggregate).where(eq(ScoreAggregate.unitId, params.unitId)),
          );
          return rows.map(aggregateToDTO);
        }),
      )

      // ── User scores for a unit / 用户对某个 unit 的评分条目 ─────
      .handle("userScores", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(ScoreEntry)
              .where(and(eq(ScoreEntry.userId, params.userId), eq(ScoreEntry.unitId, params.unitId))),
          );
          return rows.map(entryToDTO);
        }),
      )

      // ── Recalculate aggregate (admin) / 管理员触发重算 ──────────
      .handle("recalculate", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Admin check / 管理员检查
          const userRows = yield* Effect.orDie(
            db
              .select({ permission: User.permission })
              .from(User)
              .where(eq(User.unitId, user.id))
              .limit(1),
          );
          const perm = userRows[0]?.permission as { role?: string } | null;
          const isAdmin = perm?.role === "ADMIN" || perm?.role === "ROOT";
          if (!isAdmin) return yield* new ScoreForbidden();

          // Fetch all entries for the unit+realm / 获取该 unit+realm 的所有条目
          const entries = yield* Effect.orDie(
            db
              .select()
              .from(ScoreEntry)
              .where(and(eq(ScoreEntry.unitId, payload.unitId), eq(ScoreEntry.realm, payload.realm))),
          );

          // No entries: delete aggregate and return null / 无条目：删除聚合并返回 null
          if (entries.length === 0) {
            yield* Effect.orDie(
              db
                .delete(ScoreAggregate)
                .where(
                  and(eq(ScoreAggregate.unitId, payload.unitId), eq(ScoreAggregate.realm, payload.realm)),
                ),
            );
            return null;
          }

          // Recompute from scratch / 从头重新计算
          const computed = computeAggregateFromEntries(entries);

          const aggRows = yield* Effect.orDie(
            db
              .insert(ScoreAggregate)
              .values({
                unitId: payload.unitId,
                realm: payload.realm,
                ...computed,
                distribution: computed.distribution,
                fields: computed.fields ?? undefined,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [ScoreAggregate.unitId, ScoreAggregate.realm],
                set: {
                  ...computed,
                  distribution: computed.distribution,
                  fields: computed.fields ?? undefined,
                  updatedAt: new Date(),
                },
              })
              .returning(),
          );

          return aggRows[0] ? aggregateToDTO(aggRows[0]) : null;
        }),
      )

      // ── List realm fields / 列出 realm 的评分字段 ───────────────
      .handle("listRealmFields", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(ScoreRealmField)
              .where(eq(ScoreRealmField.realm, params.realmId))
              .orderBy(asc(ScoreRealmField.position), asc(ScoreRealmField.key)),
          );
          return rows.map(realmFieldToDTO);
        }),
      )

      // ── Add realm field (admin) / 新增 realm 字段（管理员） ─────
      .handle("addRealmField", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Admin check / 管理员检查
          const userRows = yield* Effect.orDie(
            db
              .select({ permission: User.permission })
              .from(User)
              .where(eq(User.unitId, user.id))
              .limit(1),
          );
          const perm = userRows[0]?.permission as { role?: string } | null;
          const isAdmin = perm?.role === "ADMIN" || perm?.role === "ROOT";
          if (!isAdmin) return yield* new ScoreForbidden();

          // Compute position: after the last existing field / 计算 position：排在最后一个已有字段之后
          const lastRows = yield* Effect.orDie(
            db
              .select({ position: ScoreRealmField.position })
              .from(ScoreRealmField)
              .where(eq(ScoreRealmField.realm, params.realmId))
              .orderBy(desc(ScoreRealmField.position), desc(ScoreRealmField.key))
              .limit(1),
          );
          const position = payload.position ?? generateAfter(lastRows[0]?.position);

          const fieldRows = yield* Effect.orDie(
            db
              .insert(ScoreRealmField)
              .values({
                realm: params.realmId,
                key: payload.key,
                label: payload.label ?? null,
                position,
                updatedAt: new Date(),
              })
              .returning(),
          );

          return realmFieldToDTO(fieldRows[0]!);
        }),
      )

      // ── Remove realm field (admin) / 移除 realm 字段（管理员） ──
      .handle("removeRealmField", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Admin check / 管理员检查
          const userRows = yield* Effect.orDie(
            db
              .select({ permission: User.permission })
              .from(User)
              .where(eq(User.unitId, user.id))
              .limit(1),
          );
          const perm = userRows[0]?.permission as { role?: string } | null;
          const isAdmin = perm?.role === "ADMIN" || perm?.role === "ROOT";
          if (!isAdmin) return yield* new ScoreForbidden();

          // Check field exists / 检查字段是否存在
          const existing = yield* Effect.orDie(
            db
              .select()
              .from(ScoreRealmField)
              .where(and(eq(ScoreRealmField.realm, params.realmId), eq(ScoreRealmField.key, params.key)))
              .limit(1),
          );
          if (!existing[0]) return yield* new ScoreNotFound();

          yield* Effect.orDie(
            db
              .delete(ScoreRealmField)
              .where(and(eq(ScoreRealmField.realm, params.realmId), eq(ScoreRealmField.key, params.key))),
          );
        }),
      );
  }),
);
