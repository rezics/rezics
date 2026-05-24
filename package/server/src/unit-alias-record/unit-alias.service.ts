import type {
  CreateUnitAliasInput,
  PatchUnitAliasPinInput,
  RezicsSessionClaims,
  UnitAliasListQuery,
  UpdateUnitAliasInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { prisma, UnitAliasStatus } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { isAdminRole, verifyAdminFromDb } from "@/middleware";
import { hasAuthorityOver } from "@/unit/authority";
import { AppError, forbidden, notFound } from "@/utils/errors";
import { normalizeUnitAliasValue, trimUnitAliasValue } from "./normalizer";

export const ALIAS_VISIBILITY_THRESHOLD = -100;

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

export class UnitAliasService {
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

    const where: any = {
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      status: query.status ?? UnitAliasStatus.ACTIVE,
      ...(query.q?.trim()
        ? {
            normalizedValue: {
              contains: normalizeUnitAliasValue(query.q),
              mode: "insensitive",
            },
          }
        : {}),
      ...(includeBelowThreshold
        ? {}
        : {
            OR: [
              { score: { gt: ALIAS_VISIBILITY_THRESHOLD } },
              { pinned: true },
            ],
          }),
    };

    const [aliases, total] = await Promise.all([
      prisma.unitAlias.findMany({
        where,
        orderBy: [
          { pinned: "desc" },
          { position: "asc" },
          { score: "desc" },
          { value: "asc" },
        ],
        skip,
        take: limit,
      }),
      prisma.unitAlias.count({ where }),
    ]);

    return { aliases, total, includeBelowThreshold };
  }

  async create(userId: string, input: CreateUnitAliasInput) {
    const normalized = normalizeInputValue(input.value);

    const alias = await prisma.$transaction(async (tx) => {
      await tx.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { id: true },
      });

      const row = await tx.unitAlias.upsert({
        where: {
          unitId_normalizedValue: {
            unitId: input.unitId,
            normalizedValue: normalized.normalizedValue,
          },
        },
        update: {},
        create: {
          unitId: input.unitId,
          value: normalized.value,
          normalizedValue: normalized.normalizedValue,
          language: input.language ?? null,
          kind: input.kind ?? "COMMON",
          createdById: userId,
          updatedById: userId,
        },
      });

      await tx.unitAliasVote.upsert({
        where: { aliasId_userId: { aliasId: row.id, userId } },
        update: {},
        create: { aliasId: row.id, userId, value: 1 },
      });

      return this.recalculateAliasScore(tx, row.id);
    });

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

    const alias = await prisma.unitAlias.update({
      where: { id: aliasId },
      data: {
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
      },
    });

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async castVote(userId: string, aliasId: string, value: number) {
    const alias = await prisma.$transaction(async (tx) => {
      const current = await tx.unitAlias.findUniqueOrThrow({
        where: { id: aliasId },
        select: { id: true },
      });

      await tx.unitAliasVote.upsert({
        where: { aliasId_userId: { aliasId: current.id, userId } },
        update: { value: normalizeVoteValue(value) },
        create: {
          aliasId: current.id,
          userId,
          value: normalizeVoteValue(value),
        },
      });

      return this.recalculateAliasScore(tx, current.id);
    });

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

    const alias = await prisma.unitAlias.update({
      where: { id: aliasId },
      data: { ...data, updatedById: actor.userId },
    });

    await patchAliasSearchDocuments(alias.unitId);
    return alias;
  }

  async hide(aliasId: string, actor: RezicsSessionClaims) {
    return this.update(aliasId, { status: UnitAliasStatus.HIDDEN }, actor);
  }

  async delete(aliasId: string, actor: RezicsSessionClaims): Promise<void> {
    const current = await this.getExistingAlias(aliasId);
    await this.assertCanManage(current.unitId, actor);
    await prisma.unitAlias.delete({ where: { id: aliasId } });
    await patchAliasSearchDocuments(current.unitId);
  }

  private async getExistingAlias(aliasId: string) {
    const alias = await prisma.unitAlias.findUnique({ where: { id: aliasId } });
    if (!alias) throw notFound("UnitAlias");
    return alias;
  }

  private async assertCanManage(
    unitId: string,
    actor: RezicsSessionClaims,
  ): Promise<void> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, userId: true },
    });
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
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, userId: true },
    });
    return unit ? hasAuthorityOver(actor, unit) : false;
  }

  private async recalculateAliasScore(
    tx: Pick<typeof prisma, "unitAliasVote" | "unitAlias">,
    aliasId: string,
  ) {
    const agg = await tx.unitAliasVote.aggregate({
      where: { aliasId },
      _sum: { value: true },
      _count: { value: true },
    });

    return tx.unitAlias.update({
      where: { id: aliasId },
      data: {
        score: agg._sum.value ?? 0,
        voteCount: agg._count.value ?? 0,
      },
    });
  }
}

export const unitAliasService = new UnitAliasService();
