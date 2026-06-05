import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "./client";
import {
  outboxProcessingFailures,
  revisionContents,
  type StructureEventRow,
  structureEvents,
  type UnitRevisionPathRow,
  type UnitRevisionRow,
  unitRevisionPaths,
  unitRevisions,
} from "./schema";

type RevisionInclude = {
  content?: boolean;
  paths?: { select?: { path?: boolean } } | boolean;
};

type UnitRevisionWithIncludes = UnitRevisionRow & {
  content?: { hash: string; payload: unknown; createdAt: Date } | null;
  paths?: Array<{ path: string }>;
};

function conditionsOf<T>(conditions: Array<T | undefined>): T[] {
  return conditions.filter((condition) => condition !== undefined);
}

async function attachRevisionIncludes(
  row: UnitRevisionRow,
  include?: RevisionInclude,
): Promise<UnitRevisionWithIncludes> {
  const result: UnitRevisionWithIncludes = { ...row };

  if (include?.content) {
    result.content =
      (
        await db
          .select()
          .from(revisionContents)
          .where(eq(revisionContents.hash, row.contentHash))
          .limit(1)
      )[0] ?? null;
  }

  if (include?.paths) {
    result.paths = (
      await db
        .select({ path: unitRevisionPaths.path })
        .from(unitRevisionPaths)
        .where(eq(unitRevisionPaths.revisionId, row.id))
        .orderBy(asc(unitRevisionPaths.path))
    ).map((path) => ({ path: path.path }));
  }

  return result;
}

async function attachRevisionIncludesMany(
  rows: UnitRevisionRow[],
  include?: RevisionInclude,
): Promise<UnitRevisionWithIncludes[]> {
  return Promise.all(rows.map((row) => attachRevisionIncludes(row, include)));
}

export class DrizzleHistoryRepository {
  readonly revisionContent = {
    upsert: async ({ where, create }: any) => {
      const [row] = await db
        .insert(revisionContents)
        .values({
          hash: where.hash,
          payload: create.payload,
        })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    },
  };

  readonly unitRevision = {
    upsert: async ({ where, create, include }: any) => {
      const key = where.unitId_sequence;
      const existing = await this.findUnitRevisionByKey(
        key.unitId,
        BigInt(key.sequence),
      );
      if (existing) return attachRevisionIncludes(existing, include);

      const [inserted] = await db
        .insert(unitRevisions)
        .values({
          unitId: create.unitId,
          sequence: BigInt(create.sequence),
          contentHash: create.contentHash,
          actorUserId: create.actorUserId,
          message: create.message ?? null,
          restoreSource: create.restoreSource ?? null,
          createdAt: create.createdAt,
        })
        .onConflictDoNothing()
        .returning();

      const row =
        inserted ??
        (await this.findUnitRevisionByKey(key.unitId, BigInt(key.sequence)));
      if (!row) throw new Error("Failed to upsert unit revision");
      return attachRevisionIncludes(row, include);
    },

    findMany: async ({
      where,
      orderBy,
      take,
      cursor,
      skip,
      include,
    }: any = {}) => {
      const cursorRow =
        cursor?.id &&
        (
          await db
            .select()
            .from(unitRevisions)
            .where(eq(unitRevisions.id, cursor.id))
            .limit(1)
        )[0];
      const conditions = conditionsOf([
        where?.unitId ? eq(unitRevisions.unitId, where.unitId) : undefined,
        cursorRow && skip
          ? orderBy?.sequence === "desc"
            ? lte(unitRevisions.sequence, cursorRow.sequence - 1n)
            : gt(unitRevisions.sequence, cursorRow.sequence)
          : undefined,
      ]);

      const isUnitSequenceAsc =
        Array.isArray(orderBy) &&
        orderBy.some((order: any) => order.unitId === "asc") &&
        orderBy.some((order: any) => order.sequence === "asc");
      const rows = await db
        .select()
        .from(unitRevisions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          isUnitSequenceAsc
            ? asc(unitRevisions.unitId)
            : desc(unitRevisions.sequence),
          isUnitSequenceAsc
            ? asc(unitRevisions.sequence)
            : desc(unitRevisions.createdAt),
        )
        .limit(take ?? 100);
      return attachRevisionIncludesMany(rows, include);
    },

    findUnique: async ({ where, include }: any) => {
      const key = where.unitId_sequence;
      const row = await this.findUnitRevisionByKey(
        key.unitId,
        BigInt(key.sequence),
      );
      return row ? attachRevisionIncludes(row, include) : null;
    },
  };

  readonly unitRevisionPath = {
    upsert: async ({ where, create, update }: any) => {
      const key = where.unitId_sequence_path;
      const [row] = await db
        .insert(unitRevisionPaths)
        .values({
          unitId: create.unitId,
          sequence: BigInt(create.sequence),
          path: create.path,
          value: create.value,
          revisionId: create.revisionId,
        })
        .onConflictDoUpdate({
          target: [
            unitRevisionPaths.unitId,
            unitRevisionPaths.sequence,
            unitRevisionPaths.path,
          ],
          set: {
            value: update.value,
            revisionId: update.revisionId,
          },
        })
        .returning();

      if (!row) {
        throw new Error(
          `Failed to upsert revision path ${key.unitId}:${key.sequence}:${key.path}`,
        );
      }
      return row;
    },

    findMany: async ({ where, distinct, select, orderBy }: any = {}) => {
      const conditions = conditionsOf([
        where?.unitId ? eq(unitRevisionPaths.unitId, where.unitId) : undefined,
        where?.sequence?.gt !== undefined
          ? gt(unitRevisionPaths.sequence, BigInt(where.sequence.gt))
          : undefined,
        where?.sequence?.lte !== undefined
          ? lte(unitRevisionPaths.sequence, BigInt(where.sequence.lte))
          : undefined,
        where?.path?.in
          ? inArray(unitRevisionPaths.path, where.path.in)
          : undefined,
      ]);

      const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

      if (distinct?.includes("path") && select?.path) {
        return db
          .selectDistinct({ path: unitRevisionPaths.path })
          .from(unitRevisionPaths)
          .where(baseWhere)
          .orderBy(asc(unitRevisionPaths.path));
      }

      const rows = await db
        .select()
        .from(unitRevisionPaths)
        .where(baseWhere)
        .orderBy(
          Array.isArray(orderBy)
            ? asc(unitRevisionPaths.path)
            : asc(unitRevisionPaths.path),
          Array.isArray(orderBy)
            ? desc(unitRevisionPaths.sequence)
            : asc(unitRevisionPaths.sequence),
        );

      if (select?.path) return rows.map((row) => ({ path: row.path }));
      return rows;
    },
  };

  readonly structureEvent = {
    upsert: async ({ where, create }: any) => {
      const key = where.unitId_sequence_eventType;
      const existing = await this.findStructureEventByKey(
        key.unitId,
        BigInt(key.sequence),
        key.eventType,
      );
      if (existing) return existing;

      const [inserted] = await db
        .insert(structureEvents)
        .values({
          unitId: create.unitId,
          sequence: BigInt(create.sequence),
          eventType: create.eventType,
          actorUserId: create.actorUserId,
          changedFieldKeys: create.changedFieldKeys,
          payload: create.payload,
          message: create.message ?? null,
          createdAt: create.createdAt,
        })
        .onConflictDoNothing()
        .returning();

      const row =
        inserted ??
        (await this.findStructureEventByKey(
          key.unitId,
          BigInt(key.sequence),
          key.eventType,
        ));
      if (!row) throw new Error("Failed to upsert structure event");
      return row;
    },

    findMany: async ({ where, orderBy, take, cursor, skip }: any = {}) => {
      const cursorRow =
        cursor?.id &&
        (
          await db
            .select()
            .from(structureEvents)
            .where(eq(structureEvents.id, cursor.id))
            .limit(1)
        )[0];
      const conditions = conditionsOf([
        where?.unitId ? eq(structureEvents.unitId, where.unitId) : undefined,
        where?.eventType
          ? eq(structureEvents.eventType, where.eventType)
          : undefined,
        cursorRow && skip
          ? orderBy?.sequence === "desc"
            ? lte(structureEvents.sequence, cursorRow.sequence - 1n)
            : gt(structureEvents.sequence, cursorRow.sequence)
          : undefined,
      ]);

      return db
        .select()
        .from(structureEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(structureEvents.sequence))
        .limit(take ?? 100);
    },

    findUnique: async ({ where }: any) => {
      const key = where.unitId_sequence_eventType;
      return this.findStructureEventByKey(
        key.unitId,
        BigInt(key.sequence),
        key.eventType,
      );
    },
  };

  readonly outboxProcessingFailure = {
    upsert: async ({ where, update, create }: any) => {
      const now = new Date();
      const [row] = await db
        .insert(outboxProcessingFailures)
        .values({
          outboxId: where.outboxId,
          attempts: create.attempts ?? 0,
          lastError: create.lastError ?? null,
          retryAfter: create.retryAfter ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: outboxProcessingFailures.outboxId,
          set: {
            attempts: update.attempts,
            lastError: update.lastError ?? null,
            retryAfter: update.retryAfter ?? null,
            updatedAt: now,
          },
        })
        .returning();

      return row ?? null;
    },
  };

  private async findUnitRevisionByKey(
    unitId: string,
    sequence: bigint,
  ): Promise<UnitRevisionRow | null> {
    return (
      (
        await db
          .select()
          .from(unitRevisions)
          .where(
            and(
              eq(unitRevisions.unitId, unitId),
              eq(unitRevisions.sequence, sequence),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }

  private async findStructureEventByKey(
    unitId: string,
    sequence: bigint,
    eventType: string,
  ): Promise<StructureEventRow | null> {
    return (
      (
        await db
          .select()
          .from(structureEvents)
          .where(
            and(
              eq(structureEvents.unitId, unitId),
              eq(structureEvents.sequence, sequence),
              eq(structureEvents.eventType, eventType),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
  }
}

export const historyRepository = new DrizzleHistoryRepository();

export type { UnitRevisionPathRow };
