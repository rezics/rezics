import { and, asc, eq, inArray } from "drizzle-orm";
import {
  Post,
  ScoreAggregate,
  ScoreEntry,
  ScoreRealmField,
  Unit,
} from "../db/schema";
import {
  applyDistributionDelta,
  applyFieldsDelta,
  computeAggregateFromEntries,
  emptyDistribution,
  validateFields,
  validateScore,
} from "./score.mapper";
import type { Distribution, FieldsAggregate } from "./score.types";

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export class ScoreService {
  // ============================================================
  // SCORE ENTRY + AGGREGATE OPERATIONS
  // 评分条目 + 聚合操作
  // ============================================================

  async upsertScore(
    userId: string,
    unitId: string,
    realm: string,
    value: number,
    fields?: Record<string, number>,
  ) {
    if (!validateScore(value)) {
      throw new Error(
        `Score value must be an integer between 1 and 10, got ${value}`,
      );
    }

    // Validate fields against realm field registry
    // 根据 realm 字段注册表校验各字段
    if (fields && Object.keys(fields).length > 0) {
      const db = await getServerDb();
      const realmFields = await db
        .select({ key: ScoreRealmField.key })
        .from(ScoreRealmField)
        .where(eq(ScoreRealmField.realm, realm));
      const allowedKeys = new Set(realmFields.map((f) => f.key));
      if (allowedKeys.size === 0) {
        throw new Error(
          "Fields submitted for a realm with no registered fields",
        );
      }
      const { valid, invalidKeys } = validateFields(fields, allowedKeys);
      if (!valid) {
        throw new Error(`Invalid field keys: ${invalidKeys.join(", ")}`);
      }
    }

    const db = await getServerDb();
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(ScoreEntry)
        .where(
          and(
            eq(ScoreEntry.userId, userId),
            eq(ScoreEntry.unitId, unitId),
            eq(ScoreEntry.realm, realm),
          ),
        )
        .limit(1);

      const oldValue = existing?.value ?? null;
      const oldFields = (existing?.fields as Record<string, number>) ?? null;
      const newFields =
        fields && Object.keys(fields).length > 0 ? fields : null;

      const updateData = {
        value,
        ...(newFields ? { fields: newFields } : {}),
        updatedAt: new Date(),
      };
      const [entry] = await tx
        .insert(ScoreEntry)
        .values({
          userId,
          unitId,
          realm,
          value,
          fields: newFields ?? undefined,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [ScoreEntry.userId, ScoreEntry.unitId, ScoreEntry.realm],
          set: updateData,
        })
        .returning();
      if (!entry) throw new Error("Failed to upsert ScoreEntry");

      await this.updateAggregate(
        tx,
        unitId,
        realm,
        oldValue,
        value,
        oldFields,
        newFields,
      );

      return entry;
    });
  }

  async deleteScore(id: string, isAdmin: boolean) {
    const db = await getServerDb();
    return db.transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(ScoreEntry)
        .where(eq(ScoreEntry.id, id))
        .limit(1);
      if (!entry) throw new Error("ScoreEntry not found");

      // Check for linked posts (reviews/remarks)
      // 检查关联的 post（评论/短评）
      const linkedPosts = await tx
        .select({ unitId: Post.unitId })
        .from(Post)
        .where(eq(Post.scoreEntryId, id));

      if (linkedPosts.length > 0 && !isAdmin) {
        const blockingIds = linkedPosts.map((p) => p.unitId);
        throw Object.assign(
          new Error("Cannot delete score with linked reviews"),
          { status: 409, blockingIds },
        );
      }

      // Admin: delete linked posts first
      // 管理员：先删除关联的 post
      if (linkedPosts.length > 0) {
        await tx.delete(Post).where(eq(Post.scoreEntryId, id));
        // Also delete the Unit records for those posts
        // 同时删除这些 post 对应的 Unit 记录
        await tx.delete(Unit).where(
          inArray(
            Unit.id,
            linkedPosts.map((p) => p.unitId),
          ),
        );
      }

      await tx.delete(ScoreEntry).where(eq(ScoreEntry.id, id));

      const oldFields = (entry.fields as Record<string, number>) ?? null;
      await this.updateAggregate(
        tx,
        entry.unitId,
        entry.realm,
        entry.value,
        null,
        oldFields,
        null,
      );

      return entry;
    });
  }

  async getAggregatesByUnit(unitId: string) {
    const db = await getServerDb();
    return db
      .select()
      .from(ScoreAggregate)
      .where(eq(ScoreAggregate.unitId, unitId));
  }

  async getAggregate(unitId: string, realm: string) {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(ScoreAggregate)
      .where(
        and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm)),
      )
      .limit(1);
    return row ?? null;
  }

  async getUserScores(userId: string, unitId: string) {
    const db = await getServerDb();
    return db
      .select()
      .from(ScoreEntry)
      .where(and(eq(ScoreEntry.userId, userId), eq(ScoreEntry.unitId, unitId)));
  }

  async recalculateAggregate(unitId: string, realm: string) {
    const db = await getServerDb();
    const entries = await db
      .select()
      .from(ScoreEntry)
      .where(and(eq(ScoreEntry.unitId, unitId), eq(ScoreEntry.realm, realm)));

    if (entries.length === 0) {
      await db
        .delete(ScoreAggregate)
        .where(
          and(
            eq(ScoreAggregate.unitId, unitId),
            eq(ScoreAggregate.realm, realm),
          ),
        );
      return null;
    }

    const computed = computeAggregateFromEntries(entries);

    const [row] = await db
      .insert(ScoreAggregate)
      .values({
        unitId,
        realm,
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
      .returning();
    return row ?? null;
  }

  // ============================================================
  // REALM FIELD OPERATIONS
  // realm 字段操作
  // ============================================================

  async listRealmFields(realmId: string) {
    const db = await getServerDb();
    return db
      .select()
      .from(ScoreRealmField)
      .where(eq(ScoreRealmField.realm, realmId))
      .orderBy(asc(ScoreRealmField.sortOrder));
  }

  async addRealmField(
    realmId: string,
    key: string,
    label?: string,
    sortOrder?: number,
  ) {
    if (!FIELD_KEY_PATTERN.test(key)) {
      throw new Error(
        `Invalid field key format: "${key}". Must match pattern: ${FIELD_KEY_PATTERN}`,
      );
    }

    const db = await getServerDb();
    const [row] = await db
      .insert(ScoreRealmField)
      .values({
        realm: realmId,
        key,
        label: label ?? null,
        sortOrder: sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .returning();
    if (!row) throw new Error("Failed to create ScoreRealmField");
    return row;
  }

  async removeRealmField(realmId: string, key: string) {
    const db = await getServerDb();
    const [existing] = await db
      .select()
      .from(ScoreRealmField)
      .where(
        and(eq(ScoreRealmField.realm, realmId), eq(ScoreRealmField.key, key)),
      )
      .limit(1);

    if (!existing) {
      throw Object.assign(new Error(`Field "${key}" not found for realm`), {
        status: 404,
      });
    }

    const [deleted] = await db
      .delete(ScoreRealmField)
      .where(
        and(eq(ScoreRealmField.realm, realmId), eq(ScoreRealmField.key, key)),
      )
      .returning();
    return deleted;
  }

  // ============================================================
  // PRIVATE: AGGREGATE UPDATE LOGIC
  // 私有：聚合更新逻辑
  // ============================================================

  private async updateAggregate(
    tx: any,
    unitId: string,
    realm: string,
    oldValue: number | null,
    newValue: number | null,
    oldFields: Record<string, number> | null,
    newFields: Record<string, number> | null,
  ) {
    const [existing] = await tx
      .select()
      .from(ScoreAggregate)
      .where(
        and(eq(ScoreAggregate.unitId, unitId), eq(ScoreAggregate.realm, realm)),
      )
      .limit(1);

    // Deletion case: removing the last entry
    // 删除情形：移除最后一个条目
    if (newValue === null && existing) {
      const nextCount = existing.totalCount - 1;
      if (nextCount <= 0) {
        await tx
          .delete(ScoreAggregate)
          .where(
            and(
              eq(ScoreAggregate.unitId, unitId),
              eq(ScoreAggregate.realm, realm),
            ),
          );
        return;
      }

      const distribution = applyDistributionDelta(
        existing.distribution as Distribution,
        oldValue,
        null,
      );
      const fields = applyFieldsDelta(
        existing.fields as FieldsAggregate | null,
        oldFields,
        null,
      );

      await tx
        .update(ScoreAggregate)
        .set({
          totalScore: existing.totalScore - (oldValue ?? 0),
          totalCount: nextCount,
          distribution,
          fields: fields ?? undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ScoreAggregate.unitId, unitId),
            eq(ScoreAggregate.realm, realm),
          ),
        );
      return;
    }

    // Creation case: no existing aggregate
    // 创建情形：尚不存在聚合
    if (!existing && newValue !== null) {
      const distribution: Distribution = { [String(newValue)]: 1 };
      let fields: FieldsAggregate | null = null;
      if (newFields) {
        fields = {};
        for (const [key, val] of Object.entries(newFields)) {
          fields[key] = { total: val, count: 1, dist: { [String(val)]: 1 } };
        }
      }

      await tx.insert(ScoreAggregate).values({
        unitId,
        realm,
        totalScore: newValue,
        totalCount: 1,
        distribution,
        fields: fields ?? undefined,
        updatedAt: new Date(),
      });
      return;
    }

    // Update case: existing aggregate, changing value
    // 更新情形：已存在聚合，变更其值
    if (existing && newValue !== null) {
      const deltaScore = newValue - (oldValue ?? 0);
      const deltaCount = oldValue === null ? 1 : 0;

      const distribution = applyDistributionDelta(
        existing.distribution as Distribution,
        oldValue,
        newValue,
      );
      const fields = applyFieldsDelta(
        existing.fields as FieldsAggregate | null,
        oldFields,
        newFields,
      );

      await tx
        .update(ScoreAggregate)
        .set({
          totalScore: existing.totalScore + deltaScore,
          totalCount: existing.totalCount + deltaCount,
          distribution,
          fields: fields ?? undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ScoreAggregate.unitId, unitId),
            eq(ScoreAggregate.realm, realm),
          ),
        );
    }
  }
}

export const scoreService = new ScoreService();
