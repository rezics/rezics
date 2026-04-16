import type { Prisma } from '#/prisma/client';
import { prisma } from '#/prisma/client';
import {
  applyDistributionDelta,
  applyFieldsDelta,
  computeAggregateFromEntries,
  emptyDistribution,
  validateFields,
  validateScore,
} from './score.mapper';
import type { Distribution, FieldsAggregate } from './score.types';

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

export class ScoreService {
  // ============================================================
  // SCORE ENTRY + AGGREGATE OPERATIONS
  // ============================================================

  async upsertScore(
    userId: string,
    unitId: string,
    realm: string,
    value: number,
    fields?: Record<string, number>,
  ) {
    if (!validateScore(value)) {
      throw new Error(`Score value must be an integer between 1 and 10, got ${value}`);
    }

    // Validate fields against realm field registry
    if (fields && Object.keys(fields).length > 0) {
      const realmFields = await prisma.scoreRealmField.findMany({
        where: { realm },
        select: { key: true },
      });
      const allowedKeys = new Set(realmFields.map((f) => f.key));
      if (allowedKeys.size === 0) {
        throw new Error('Fields submitted for a realm with no registered fields');
      }
      const { valid, invalidKeys } = validateFields(fields, allowedKeys);
      if (!valid) {
        throw new Error(`Invalid field keys: ${invalidKeys.join(', ')}`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.scoreEntry.findUnique({
        where: { userId_unitId_realm: { userId, unitId, realm } },
      });

      const oldValue = existing?.value ?? null;
      const oldFields = (existing?.fields as Record<string, number>) ?? null;
      const newFields = fields && Object.keys(fields).length > 0 ? fields : null;

      const entry = await tx.scoreEntry.upsert({
        where: { userId_unitId_realm: { userId, unitId, realm } },
        create: { userId, unitId, realm, value, fields: newFields as Prisma.InputJsonValue ?? undefined },
        update: { value, fields: newFields as Prisma.InputJsonValue ?? undefined },
      });

      await this.updateAggregate(tx, unitId, realm, oldValue, value, oldFields, newFields);

      return entry;
    });
  }

  async deleteScore(id: string, isAdmin: boolean) {
    return prisma.$transaction(async (tx) => {
      const entry = await tx.scoreEntry.findUniqueOrThrow({
        where: { id },
      });

      // Check for linked posts (reviews/remarks)
      const linkedPosts = await tx.post.findMany({
        where: { scoreEntryId: id },
        select: { unitId: true },
      });

      if (linkedPosts.length > 0 && !isAdmin) {
        const blockingIds = linkedPosts.map((p) => p.unitId);
        throw Object.assign(
          new Error('Cannot delete score with linked reviews'),
          { status: 409, blockingIds },
        );
      }

      // Admin: delete linked posts first
      if (linkedPosts.length > 0) {
        await tx.post.deleteMany({ where: { scoreEntryId: id } });
        // Also delete the Unit records for those posts
        await tx.unit.deleteMany({
          where: { id: { in: linkedPosts.map((p) => p.unitId) } },
        });
      }

      await tx.scoreEntry.delete({ where: { id } });

      const oldFields = (entry.fields as Record<string, number>) ?? null;
      await this.updateAggregate(tx, entry.unitId, entry.realm, entry.value, null, oldFields, null);

      return entry;
    });
  }

  async getAggregatesByUnit(unitId: string) {
    return prisma.scoreAggregate.findMany({
      where: { unitId },
    });
  }

  async getAggregate(unitId: string, realm: string) {
    return prisma.scoreAggregate.findUnique({
      where: { unitId_realm: { unitId, realm } },
    });
  }

  async getUserScores(userId: string, unitId: string) {
    return prisma.scoreEntry.findMany({
      where: { userId, unitId },
    });
  }

  async recalculateAggregate(unitId: string, realm: string) {
    const entries = await prisma.scoreEntry.findMany({
      where: { unitId, realm },
    });

    if (entries.length === 0) {
      await prisma.scoreAggregate.deleteMany({
        where: { unitId, realm },
      });
      return null;
    }

    const computed = computeAggregateFromEntries(entries);

    return prisma.scoreAggregate.upsert({
      where: { unitId_realm: { unitId, realm } },
      create: {
        unitId,
        realm,
        ...computed,
        distribution: computed.distribution as Prisma.InputJsonValue,
        fields: computed.fields as Prisma.InputJsonValue ?? undefined,
      },
      update: {
        ...computed,
        distribution: computed.distribution as Prisma.InputJsonValue,
        fields: computed.fields as Prisma.InputJsonValue ?? undefined,
      },
    });
  }

  // ============================================================
  // REALM FIELD OPERATIONS
  // ============================================================

  async listRealmFields(realmId: string) {
    return prisma.scoreRealmField.findMany({
      where: { realm: realmId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addRealmField(realmId: string, key: string, label?: string, sortOrder?: number) {
    if (!FIELD_KEY_PATTERN.test(key)) {
      throw new Error(`Invalid field key format: "${key}". Must match pattern: ${FIELD_KEY_PATTERN}`);
    }

    return prisma.scoreRealmField.create({
      data: {
        realm: realmId,
        key,
        label: label ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
  }

  async removeRealmField(realmId: string, key: string) {
    const existing = await prisma.scoreRealmField.findUnique({
      where: { realm_key: { realm: realmId, key } },
    });

    if (!existing) {
      throw Object.assign(new Error(`Field "${key}" not found for realm`), { status: 404 });
    }

    return prisma.scoreRealmField.delete({
      where: { realm_key: { realm: realmId, key } },
    });
  }

  // ============================================================
  // PRIVATE: AGGREGATE UPDATE LOGIC
  // ============================================================

  private async updateAggregate(
    tx: Prisma.TransactionClient,
    unitId: string,
    realm: string,
    oldValue: number | null,
    newValue: number | null,
    oldFields: Record<string, number> | null,
    newFields: Record<string, number> | null,
  ) {
    const existing = await tx.scoreAggregate.findUnique({
      where: { unitId_realm: { unitId, realm } },
    });

    // Deletion case: removing the last entry
    if (newValue === null && existing) {
      const nextCount = existing.totalCount - 1;
      if (nextCount <= 0) {
        await tx.scoreAggregate.delete({ where: { unitId_realm: { unitId, realm } } });
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

      await tx.scoreAggregate.update({
        where: { unitId_realm: { unitId, realm } },
        data: {
          totalScore: existing.totalScore - (oldValue ?? 0),
          totalCount: nextCount,
          distribution: distribution as Prisma.InputJsonValue,
          fields: (fields ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return;
    }

    // Creation case: no existing aggregate
    if (!existing && newValue !== null) {
      const distribution: Distribution = { [String(newValue)]: 1 };
      let fields: FieldsAggregate | null = null;
      if (newFields) {
        fields = {};
        for (const [key, val] of Object.entries(newFields)) {
          fields[key] = { total: val, count: 1, dist: { [String(val)]: 1 } };
        }
      }

      await tx.scoreAggregate.create({
        data: {
          unitId,
          realm,
          totalScore: newValue,
          totalCount: 1,
          distribution: distribution as Prisma.InputJsonValue,
          fields: (fields ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return;
    }

    // Update case: existing aggregate, changing value
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

      await tx.scoreAggregate.update({
        where: { unitId_realm: { unitId, realm } },
        data: {
          totalScore: existing.totalScore + deltaScore,
          totalCount: existing.totalCount + deltaCount,
          distribution: distribution as Prisma.InputJsonValue,
          fields: (fields ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }
}

export const scoreService = new ScoreService();
