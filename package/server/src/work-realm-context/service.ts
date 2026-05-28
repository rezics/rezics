import type {
  CreateWorkRealmContextInput,
  ListWorkRealmContextQuery,
  ResolveWorkRealmContextQuery,
  UpdateWorkRealmContextInput,
  WorkRealmContextRole,
} from "@rezics/contract";
import { prisma, UnitStatus, type UnitType } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import {
  mapResolvedWorkRealmContext,
  mapWorkRealmContextConflict,
} from "./mapper";

const WORK_CAPABLE_TYPES = new Set<UnitType>(["BOOK", "GAME", "MEDIA"]);
const CONTEXT_ORDER = [
  { priority: "asc" as const },
  { locale: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

async function assertWorkUnit(workUnitId: string) {
  const workUnit = await prisma.unit.findUnique({
    where: { id: workUnitId },
    select: { id: true, type: true, status: true },
  });

  if (!workUnit) {
    throw new AppError(404, "Work Unit not found", {
      code: "WORK_UNIT_INVALID",
    });
  }
  if (
    !WORK_CAPABLE_TYPES.has(workUnit.type) ||
    workUnit.status === UnitStatus.DELETED
  ) {
    throw new AppError(
      400,
      "WorkRealmContext workUnitId must be a work-capable Unit",
      {
        code: "WORK_UNIT_INVALID",
        details: { workUnitId, type: workUnit.type, status: workUnit.status },
      },
    );
  }

  const releaseMembership = await prisma.unitWork.findFirst({
    where: { unitId: workUnitId, role: "RELEASE" },
    select: { workUnitId: true },
  });
  if (releaseMembership) {
    throw new AppError(
      400,
      "WorkRealmContext workUnitId cannot be a release Unit",
      {
        code: "WORK_UNIT_INVALID",
        details: { workUnitId, parentWorkUnitId: releaseMembership.workUnitId },
      },
    );
  }

  return workUnit;
}

async function assertRealmUnit(realmUnitId: string) {
  const realm = await prisma.unit.findUnique({
    where: { id: realmUnitId },
    select: { id: true, type: true, status: true },
  });

  if (!realm || realm.type !== "REALM" || realm.status === UnitStatus.DELETED) {
    throw new AppError(
      400,
      "WorkRealmContext realmUnitId must be a REALM Unit",
      {
        code: "REALM_UNIT_INVALID",
        details: {
          realmUnitId,
          type: realm?.type ?? null,
          status: realm?.status ?? null,
        },
      },
    );
  }
}

async function assertReleaseOverride(
  workUnitId: string,
  releaseUnitId: string | null | undefined,
) {
  if (!releaseUnitId) return;

  const release = await prisma.unitWork.findFirst({
    where: { unitId: releaseUnitId, workUnitId, role: "RELEASE" },
    select: { unitId: true },
  });
  if (!release) {
    throw new AppError(
      400,
      "WorkRealmContext releaseUnitId must be a release in the same work domain",
      {
        code: "RELEASE_UNIT_INVALID",
        details: { workUnitId, releaseUnitId },
      },
    );
  }
}

export class WorkRealmContextService {
  async list(query: ListWorkRealmContextQuery = {}) {
    return prisma.workRealmContext.findMany({
      where: {
        ...(query.workUnitId ? { workUnitId: query.workUnitId } : {}),
        ...(query.realmUnitId ? { realmUnitId: query.realmUnitId } : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(query.locale ? { locale: query.locale } : {}),
        ...(query.releaseUnitId ? { releaseUnitId: query.releaseUnitId } : {}),
      },
      orderBy: CONTEXT_ORDER,
      take: Math.max(1, Math.min(query.limit ?? 50, 100)),
    });
  }

  async getById(id: string) {
    return prisma.workRealmContext.findUnique({ where: { id } });
  }

  async create(input: CreateWorkRealmContextInput, actorUserId?: string) {
    await assertWorkUnit(input.workUnitId);
    await assertRealmUnit(input.realmUnitId);
    await assertReleaseOverride(input.workUnitId, input.releaseUnitId);

    return prisma.workRealmContext.create({
      data: {
        workUnitId: input.workUnitId,
        realmUnitId: input.realmUnitId,
        role: input.role,
        priority: input.priority ?? 0,
        locale: input.locale ?? null,
        releaseUnitId: input.releaseUnitId ?? null,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
  }

  async update(
    id: string,
    input: UpdateWorkRealmContextInput,
    actorUserId?: string,
  ) {
    const current = await prisma.workRealmContext.findUniqueOrThrow({
      where: { id },
    });
    const nextWorkUnitId = current.workUnitId;
    const nextRealmUnitId = input.realmUnitId ?? current.realmUnitId;
    const nextReleaseUnitId =
      input.releaseUnitId === undefined
        ? current.releaseUnitId
        : input.releaseUnitId;

    await assertWorkUnit(nextWorkUnitId);
    await assertRealmUnit(nextRealmUnitId);
    await assertReleaseOverride(nextWorkUnitId, nextReleaseUnitId);

    return prisma.workRealmContext.update({
      where: { id },
      data: {
        realmUnitId: input.realmUnitId,
        role: input.role,
        priority: input.priority,
        locale: input.locale,
        releaseUnitId: input.releaseUnitId,
        updatedByUserId: actorUserId ?? null,
      },
    });
  }

  async delete(id: string) {
    await prisma.workRealmContext.delete({ where: { id } });
  }

  async resolveForRelease(query: ResolveWorkRealmContextQuery) {
    const releaseMembership = await prisma.unitWork.findFirst({
      where: { unitId: query.releaseUnitId, role: "RELEASE" },
      select: { workUnitId: true },
    });

    if (!releaseMembership) {
      return mapResolvedWorkRealmContext({
        releaseUnitId: query.releaseUnitId,
        workUnitId: null,
        contexts: [],
        conflicts: [],
      });
    }

    const roleFilter: WorkRealmContextRole[] = [
      "official",
      "language",
      ...(query.includeCommunity ? (["community"] as const) : []),
      ...(query.includeArchive ? (["archive"] as const) : []),
    ];

    const contexts = await prisma.workRealmContext.findMany({
      where: {
        workUnitId: releaseMembership.workUnitId,
        role: { in: roleFilter },
        OR: [{ releaseUnitId: null }, { releaseUnitId: query.releaseUnitId }],
      },
      orderBy: CONTEXT_ORDER,
    });

    const localeMatched = query.locale
      ? contexts.filter(
          (context) =>
            context.locale === null || context.locale === query.locale,
        )
      : contexts;

    const officialByPriority = new Map<number, typeof contexts>();
    for (const context of localeMatched) {
      if (context.role !== "official") continue;
      const bucket = officialByPriority.get(context.priority) ?? [];
      bucket.push(context);
      officialByPriority.set(context.priority, bucket);
    }

    const conflicts = [...officialByPriority.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([priority, rows]) =>
        mapWorkRealmContextConflict({
          workUnitId: releaseMembership.workUnitId,
          role: "official",
          locale: query.locale ?? null,
          releaseUnitId: query.releaseUnitId,
          contextIds: rows.map((row) => row.id),
        }),
      );

    return mapResolvedWorkRealmContext({
      releaseUnitId: query.releaseUnitId,
      workUnitId: releaseMembership.workUnitId,
      contexts: localeMatched,
      conflicts,
    });
  }
}

export const workRealmContextService = new WorkRealmContextService();
