import type {
  CreateUnitWorkInput,
  ListUnitWorkQuery,
  UpdateUnitWorkInput,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  prisma,
  UnitStatus,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
  type UnitWork,
} from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import { unitWorkOrderBy } from "./unit-work.types";

const RELEASE_ROLE = UnitWorkRole.RELEASE;

async function enqueueWorkDomainProjectionSync(unitId: string) {
  const source = { type: "server" as const, service: "unit-work" };
  await Promise.all([
    serverJobProducer.enqueue(
      createSearchCommand(SEARCH_COMMAND_KINDS.contentSync, { unitId }, source),
    ),
    serverJobProducer.enqueue(
      createSearchCommand(
        SEARCH_COMMAND_KINDS.postSync,
        { postId: unitId },
        source,
      ),
    ),
  ]);
}

export class UnitWorkService {
  async list(query: ListUnitWorkQuery = {}): Promise<UnitWork[]> {
    return prisma.unitWork.findMany({
      where: {
        ...(query.unitId ? { unitId: query.unitId } : {}),
        ...(query.workUnitId ? { workUnitId: query.workUnitId } : {}),
        ...(query.role ? { role: query.role } : {}),
      },
      orderBy: unitWorkOrderBy,
      take: Math.max(1, Math.min(query.limit ?? 50, 100)),
    });
  }

  async create(input: CreateUnitWorkInput): Promise<UnitWork> {
    const role = input.role as UnitWorkRole;
    await this.assertValidMembership(input.unitId, input.workUnitId, role);

    const row = await prisma.$transaction(async (tx) => {
      if (role === RELEASE_ROLE) {
        const existingRelease = await tx.unitWork.findFirst({
          where: { unitId: input.unitId, role: RELEASE_ROLE },
          select: { workUnitId: true },
        });
        if (
          existingRelease &&
          existingRelease.workUnitId !== input.workUnitId
        ) {
          throw new AppError(
            409,
            "Release already belongs to another work domain",
            { code: "unit_work_release_duplicate" },
          );
        }
      }

      const membership = await tx.unitWork.upsert({
        where: {
          unitId_workUnitId_role: {
            unitId: input.unitId,
            workUnitId: input.workUnitId,
            role,
          },
        },
        update: {
          language: input.language ?? null,
          position: input.position ?? null,
          displayPolicy:
            (input.displayPolicy as UnitWorkDisplayPolicy | undefined) ??
            UnitWorkDisplayPolicy.PRIMARY,
        },
        create: {
          unitId: input.unitId,
          workUnitId: input.workUnitId,
          role,
          language: input.language ?? null,
          position: input.position ?? null,
          displayPolicy:
            (input.displayPolicy as UnitWorkDisplayPolicy | undefined) ??
            UnitWorkDisplayPolicy.PRIMARY,
        },
      });

      return membership;
    });

    await enqueueWorkDomainProjectionSync(input.unitId);
    return row;
  }

  async update(
    unitId: string,
    workUnitId: string,
    role: UnitWorkRole,
    input: UpdateUnitWorkInput,
  ): Promise<UnitWork> {
    const row = await prisma.unitWork.update({
      where: { unitId_workUnitId_role: { unitId, workUnitId, role } },
      data: {
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.displayPolicy !== undefined
          ? { displayPolicy: input.displayPolicy as UnitWorkDisplayPolicy }
          : {}),
      },
    });
    await enqueueWorkDomainProjectionSync(unitId);
    return row;
  }

  async delete(
    unitId: string,
    workUnitId: string,
    role: UnitWorkRole,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.unitWork.delete({
        where: { unitId_workUnitId_role: { unitId, workUnitId, role } },
      });
    });
    await enqueueWorkDomainProjectionSync(unitId);
  }

  async reconcileContentMemberships(
    unitId: string,
    role: Exclude<UnitWorkRole, "RELEASE">,
    targetUnitIds: string[],
  ): Promise<UnitWork[]> {
    const releaseMemberships = await prisma.unitWork.findMany({
      where: {
        unitId: { in: [...new Set(targetUnitIds)] },
        role: RELEASE_ROLE,
      },
      select: { workUnitId: true },
      distinct: ["workUnitId"],
    });

    const workUnitIds = releaseMemberships.map((row) => row.workUnitId);
    const rows = await prisma.$transaction(
      workUnitIds.map((workUnitId) =>
        prisma.unitWork.upsert({
          where: {
            unitId_workUnitId_role: { unitId, workUnitId, role },
          },
          update: {},
          create: {
            unitId,
            workUnitId,
            role,
            displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
          },
        }),
      ),
    );

    if (rows.length > 0) {
      await Promise.all(
        rows.map((row) => enqueueWorkDomainProjectionSync(row.unitId)),
      );
    }
    return rows;
  }

  private async assertValidMembership(
    unitId: string,
    workUnitId: string,
    role: UnitWorkRole,
  ) {
    if (unitId === workUnitId) {
      throw new AppError(400, "Unit cannot join itself as a work domain", {
        code: "unit_work_self_reference",
      });
    }

    const [unit, workUnit] = await Promise.all([
      prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, type: true, status: true },
      }),
      prisma.unit.findUnique({
        where: { id: workUnitId },
        select: { id: true, type: true, status: true },
      }),
    ]);

    if (!unit) {
      throw new AppError(404, "Unit not found", { code: "unit_not_found" });
    }
    if (!workUnit) {
      throw new AppError(404, "Work Unit not found", {
        code: "work_unit_not_found",
      });
    }
    if (role === RELEASE_ROLE && unit.type !== workUnit.type) {
      throw new AppError(400, "Release and work Unit types must match", {
        code: "unit_work_type_mismatch",
      });
    }
    if (workUnit.status === UnitStatus.DELETED) {
      throw new AppError(400, "Deleted Unit cannot be used as a work domain", {
        code: "unit_work_deleted_work",
      });
    }
    if (role === RELEASE_ROLE) {
      const workUnitReleaseMembership = await prisma.unitWork.findFirst({
        where: { unitId: workUnitId, role: RELEASE_ROLE },
        select: { workUnitId: true },
      });
      if (workUnitReleaseMembership) {
        throw new AppError(400, "Work Unit cannot itself be a release", {
          code: "unit_work_nested_release",
        });
      }
    }
  }
}

export const unitWorkService = new UnitWorkService();
