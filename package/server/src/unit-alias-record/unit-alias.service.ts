import type {
  CreateUnitAliasInput,
  PatchUnitAliasPinInput,
  RezicsSessionClaims,
  UnitAliasListQuery,
  UpdateUnitAliasInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, desc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { serverJobProducer } from "../job/job-boundary";
import { isAdminRole, verifyAdminFromDb } from "../middleware";
import {
  Unit,
  UnitAlias,
  UnitAliasStatus as UnitAliasStatusEnum,
  UnitAliasVote,
} from "../db/schema";
import type { ServerDb } from "../db/client";
import { hasAuthorityOver } from "../unit/authority";
import { AppError, forbidden, notFound } from "../utils/errors";
import { normalizeUnitAliasValue, trimUnitAliasValue } from "./normalizer";

export const ALIAS_VISIBILITY_THRESHOLD = -100;

type UnitAliasRow = typeof UnitAlias.$inferSelect;
type UnitAliasStatusStorage = (typeof UnitAliasStatusEnum.enumValues)[number];
type UnitAliasScoreTx = Pick<ServerDb, "select" | "update">;

async function patchAliasSearchDocuments(unitId: string): Promise<void> {
  await Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.contentPatchAliases,
        { unitId },
        { type: "server", service: "unit-alias-record" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.entityPatchAliases,
        { unitId },
        { type: "server", service: "unit-alias-record" },
      ),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.realmPatchAliases,
        { unitId },
        { type: "server", service: "unit-alias-record" },
      ),
    ),
  ]);
}

function normalizeVoteValue(value: number): number {
  return value > 0 ? 1 : -1;
}

function normalizeInputValue(value: string): {
  value: string;
  normalizedValue: string;
} {
  const trimmed = trimUnitAliasValue(value);
  const normalizedValue = normalizeUnitAliasValue(trimmed);
  if (!trimmed || !normalizedValue) {
    throw new AppError(400, "Alias value must not be empty", {
      code: "UNIT_ALIAS_EMPTY",
    });
  }
  return { value: trimmed, normalizedValue };
}

export interface UnitAliasRepository {
  list(input: {
    query: UnitAliasListQuery;
    includeBelowThreshold: boolean;
    skip: number;
    limit: number;
  }): Promise<{ aliases: UnitAliasRow[]; total: number }>;
  create(
    userId: string,
    input: CreateUnitAliasInput,
    normalized: { value: string; normalizedValue: string },
  ): Promise<UnitAliasRow>;
  update(
    aliasId: string,
    data: {
      value?: string;
      normalizedValue?: string;
      language?: string | null;
      kind?: string;
      status?: string;
      pinned?: boolean;
      position?: string | null;
      updatedById: string;
    },
  ): Promise<UnitAliasRow>;
  castVote(
    userId: string,
    aliasId: string,
    value: number,
  ): Promise<UnitAliasRow>;
  delete(aliasId: string): Promise<void>;
  getAlias(aliasId: string): Promise<UnitAliasRow | null>;
  getUnitAuthority(
    unitId: string,
  ): Promise<{ id: string; userId: string | null } | null>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function aliasVisibilityCondition(includeBelowThreshold: boolean) {
  return includeBelowThreshold
    ? undefined
    : or(
        gt(UnitAlias.score, ALIAS_VISIBILITY_THRESHOLD),
        eq(UnitAlias.pinned, true),
      );
}

function createDrizzleUnitAliasRepository(): UnitAliasRepository {
  async function recalculateAliasScore(tx: UnitAliasScoreTx, aliasId: string) {
    const [aggregate] = await tx
      .select({
        score: sql<number>`coalesce(sum(${UnitAliasVote.value}), 0)::int`,
        voteCount: sql<number>`count(${UnitAliasVote.value})::int`,
      })
      .from(UnitAliasVote)
      .where(eq(UnitAliasVote.aliasId, aliasId));

    const [alias] = await tx
      .update(UnitAlias)
      .set({
        score: aggregate?.score ?? 0,
        voteCount: aggregate?.voteCount ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(UnitAlias.id, aliasId))
      .returning();
    if (!alias) throw notFound("UnitAlias");
    return alias;
  }

  return {
    async list(input) {
      const db = await getServerDb();
      const filters = [
        input.query.unitId
          ? eq(UnitAlias.unitId, input.query.unitId)
          : undefined,
        input.query.language
          ? eq(UnitAlias.language, input.query.language)
          : undefined,
        input.query.kind ? eq(UnitAlias.kind, input.query.kind) : undefined,
        eq(
          UnitAlias.status,
          (input.query.status ?? "ACTIVE") as UnitAliasStatusStorage,
        ),
        input.query.q?.trim()
          ? ilike(
              UnitAlias.normalizedValue,
              `%${normalizeUnitAliasValue(input.query.q)}%`,
            )
          : undefined,
        aliasVisibilityCondition(input.includeBelowThreshold),
      ].filter(Boolean) as SQL[];

      const where = filters.length > 0 ? and(...filters) : undefined;
      const [aliases, totalRows] = await Promise.all([
        db
          .select()
          .from(UnitAlias)
          .where(where)
          .orderBy(
            desc(UnitAlias.pinned),
            asc(UnitAlias.position),
            desc(UnitAlias.score),
            asc(UnitAlias.value),
          )
          .offset(input.skip)
          .limit(input.limit),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(UnitAlias)
          .where(where),
      ]);

      return { aliases, total: totalRows[0]?.count ?? 0 };
    },

    async create(userId, input, normalized) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [unit] = await tx
          .select({ id: Unit.id })
          .from(Unit)
          .where(eq(Unit.id, input.unitId))
          .limit(1);
        if (!unit) throw notFound("Unit");

        const now = new Date();
        const [inserted] = await tx
          .insert(UnitAlias)
          .values({
            unitId: input.unitId,
            value: normalized.value,
            normalizedValue: normalized.normalizedValue,
            language: input.language ?? null,
            kind: input.kind ?? "COMMON",
            createdById: userId,
            updatedById: userId,
            updatedAt: now,
          })
          .onConflictDoNothing({
            target: [UnitAlias.unitId, UnitAlias.normalizedValue],
          })
          .returning();
        const row =
          inserted ??
          (
            await tx
              .select()
              .from(UnitAlias)
              .where(
                and(
                  eq(UnitAlias.unitId, input.unitId),
                  eq(UnitAlias.normalizedValue, normalized.normalizedValue),
                ),
              )
              .limit(1)
          )[0];
        if (!row) throw new Error("Failed to create UnitAlias");

        await tx
          .insert(UnitAliasVote)
          .values({ aliasId: row.id, userId, value: 1, updatedAt: now })
          .onConflictDoNothing({
            target: [UnitAliasVote.aliasId, UnitAliasVote.userId],
          });

        return recalculateAliasScore(tx, row.id);
      });
    },

    async update(aliasId, data) {
      const db = await getServerDb();
      const [alias] = await db
        .update(UnitAlias)
        .set({
          ...data,
          kind: data.kind as UnitAliasRow["kind"] | undefined,
          status: data.status as UnitAliasStatusStorage | undefined,
          updatedAt: new Date(),
        })
        .where(eq(UnitAlias.id, aliasId))
        .returning();
      if (!alias) throw notFound("UnitAlias");
      return alias;
    },

    async castVote(userId, aliasId, value) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select({ id: UnitAlias.id })
          .from(UnitAlias)
          .where(eq(UnitAlias.id, aliasId))
          .limit(1);
        if (!current) throw notFound("UnitAlias");

        await tx
          .insert(UnitAliasVote)
          .values({
            aliasId: current.id,
            userId,
            value: normalizeVoteValue(value),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [UnitAliasVote.aliasId, UnitAliasVote.userId],
            set: { value: normalizeVoteValue(value), updatedAt: new Date() },
          });

        return recalculateAliasScore(tx, current.id);
      });
    },

    async delete(aliasId) {
      const db = await getServerDb();
      await db.delete(UnitAlias).where(eq(UnitAlias.id, aliasId));
    },

    async getAlias(aliasId) {
      const db = await getServerDb();
      const [alias] = await db
        .select()
        .from(UnitAlias)
        .where(eq(UnitAlias.id, aliasId))
        .limit(1);
      return alias ?? null;
    },

    async getUnitAuthority(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id, userId: Unit.userId })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return unit ?? null;
    },
  };
}

const defaultRepository = createDrizzleUnitAliasRepository();

export class UnitAliasService {
  constructor(
    private readonly repository: UnitAliasRepository = defaultRepository,
  ) {}

  async list(
    query: UnitAliasListQuery = {},
    actor?: RezicsSessionClaims | null,
  ) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(query.limit ?? 50), 100));
    const skip = (page - 1) * limit;

    const includeBelowThreshold = await this.canIncludeBelowThreshold(
      query.unitId,
      actor,
      Boolean(query.includeBelowThreshold),
    );

    const { aliases, total } = await this.repository.list({
      query,
      includeBelowThreshold,
      skip,
      limit,
    });

    return { aliases, total, includeBelowThreshold };
  }

  async create(userId: string, input: CreateUnitAliasInput) {
    const normalized = normalizeInputValue(input.value);

    const alias = await this.repository.create(userId, input, normalized);

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async update(
    aliasId: string,
    input: UpdateUnitAliasInput,
    actor: RezicsSessionClaims,
  ) {
    const current = await this.getExistingAlias(aliasId);
    await this.assertCanManage(current.unitId, actor);

    const normalized =
      input.value !== undefined ? normalizeInputValue(input.value) : undefined;

    const alias = await this.repository.update(aliasId, {
      ...(normalized
        ? {
            value: normalized.value,
            normalizedValue: normalized.normalizedValue,
          }
        : {}),
      ...(input.language !== undefined
        ? { language: input.language ?? null }
        : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedById: actor.userId,
    });

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async castVote(userId: string, aliasId: string, value: number) {
    const alias = await this.repository.castVote(userId, aliasId, value);

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async setPin(
    aliasId: string,
    input: PatchUnitAliasPinInput,
    actor: RezicsSessionClaims,
  ) {
    const current = await this.getExistingAlias(aliasId);
    await this.assertCanManage(current.unitId, actor);

    const data: { pinned?: boolean; position?: string | null } = {};
    if (input.pinned !== undefined) {
      data.pinned = input.pinned;
      if (input.pinned === false) data.position = null;
    }
    if (input.position !== undefined) data.position = input.position;

    const alias = await this.repository.update(aliasId, {
      ...data,
      updatedById: actor.userId,
    });

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async hide(aliasId: string, actor: RezicsSessionClaims) {
    return this.update(aliasId, { status: "HIDDEN" }, actor);
  }

  async delete(aliasId: string, actor: RezicsSessionClaims): Promise<void> {
    const current = await this.getExistingAlias(aliasId);
    await this.assertCanManage(current.unitId, actor);
    await this.repository.delete(aliasId);
    await patchAliasSearchDocuments(current.unitId);
  }

  private async getExistingAlias(aliasId: string) {
    const alias = await this.repository.getAlias(aliasId);
    if (!alias) throw notFound("UnitAlias");
    return alias;
  }

  private async assertCanManage(
    unitId: string,
    actor: RezicsSessionClaims,
  ): Promise<void> {
    const unit = await this.repository.getUnitAuthority(unitId);
    if (!unit) throw notFound("Unit");
    if (!(await hasAuthorityOver(actor, unit))) {
      throw forbidden("Unit alias management requires admin or unit authority");
    }
  }

  private async canIncludeBelowThreshold(
    unitId: string | undefined,
    actor: RezicsSessionClaims | null | undefined,
    requested: boolean,
  ): Promise<boolean> {
    if (!requested || !actor) return false;
    if (isAdminRole(actor) || (await verifyAdminFromDb(actor.userId))) {
      return true;
    }
    if (!unitId) return false;
    const unit = await this.repository.getUnitAuthority(unitId);
    return unit ? hasAuthorityOver(actor, unit) : false;
  }
}

export const unitAliasService = new UnitAliasService();
