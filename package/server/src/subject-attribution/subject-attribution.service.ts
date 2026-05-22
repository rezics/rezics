import { AttributionFieldKey } from "@rezics/contract";
import type {
  LinkSubjectAttributionInput,
  RezicsSessionClaims,
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
  SubjectAttributionDTO,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { patchContentSubjectsToMeili } from "@/meili/content/sync";
import { AppError } from "@/utils/errors";
import {
  assertCanEditCollaborativeMetadata,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { mapSubjectAttributionToDTO } from "./subject-attribution.mapper";
import { subjectAttributionInclude } from "./types";

export class SubjectAttributionService {
  private async assertEntityUnit(entityId: string): Promise<void> {
    const entityUnit = await prisma.unit.findUnique({
      where: { id: entityId },
      select: { id: true, type: true },
    });

    if (!entityUnit) {
      throw new AppError(404, "Subject Entity not found", {
        code: "subject_entity_not_found",
        details: { entityId },
      });
    }

    if (entityUnit.type !== "ENTITY") {
      throw new AppError(
        400,
        "Subject attribution entityId must reference an ENTITY Unit",
        {
          code: "subject_entity_must_be_entity_unit",
          details: { entityId, type: entityUnit.type },
        },
      );
    }
  }

  private async assertSubjectEligibility(
    req: LinkSubjectAttributionInput,
  ): Promise<void> {
    const entity = await prisma.entity.findUnique({
      where: { unitId: req.entityId },
      select: { eligibleSubjectRoles: true },
    });

    if (!entity) {
      throw new AppError(404, "Subject Entity not found", {
        code: "subject_entity_not_found",
        details: { entityId: req.entityId },
      });
    }

    if (!entity.eligibleSubjectRoles.includes(req.role)) {
      throw new AppError(400, "Entity is not eligible for subject role", {
        code: "subject_entity_role_ineligible",
        details: { entityId: req.entityId, role: req.role },
      });
    }
  }

  async link(
    req: LinkSubjectAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<SubjectAttributionDTO> {
    await this.assertEntityUnit(req.entityId);
    await this.assertSubjectEligibility(req);

    if (!actor) {
      const row = await prisma.subjectAttribution.create({
        data: {
          unitId: req.unitId,
          entityId: req.entityId,
          role: req.role,
          sortOrder: req.sortOrder ?? 0,
          weight: req.weight ?? null,
        },
        include: subjectAttributionInclude,
      });
      await patchContentSubjectsToMeili(req.unitId);
      return mapSubjectAttributionToDTO(row);
    }

    const row = await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, req.unitId, [
        AttributionFieldKey.SUBJECTS,
      ]);
      const created = await tx.subjectAttribution.create({
        data: {
          unitId: req.unitId,
          entityId: req.entityId,
          role: req.role,
          sortOrder: req.sortOrder ?? 0,
          weight: req.weight ?? null,
        },
        include: subjectAttributionInclude,
      });
      await writeEditorialMetadataHistory(tx as any, {
        unitId: req.unitId,
        actorUserId: actor.userId,
        changedFieldKeys: [AttributionFieldKey.SUBJECTS],
        message: "subject-attribution.link",
      });
      return created;
    });
    await patchContentSubjectsToMeili(req.unitId);
    return mapSubjectAttributionToDTO(row);
  }

  async unlink(
    unitId: string,
    entityId: string,
    role: string,
    actor?: RezicsSessionClaims,
  ): Promise<void> {
    if (!actor) {
      await prisma.subjectAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await patchContentSubjectsToMeili(unitId);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, unitId, [
        AttributionFieldKey.SUBJECTS,
      ]);
      await tx.subjectAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await writeEditorialMetadataHistory(tx as any, {
        unitId,
        actorUserId: actor.userId,
        changedFieldKeys: [AttributionFieldKey.SUBJECTS],
        message: "subject-attribution.unlink",
      });
    });
    await patchContentSubjectsToMeili(unitId);
  }

  async listByUnit(
    unitId: string,
    query: SubjectAttributionByUnitQuery = {},
  ): Promise<SubjectAttributionDTO[]> {
    const rows = await prisma.subjectAttribution.findMany({
      where: {
        unitId,
        ...(query.role ? { role: query.role } : {}),
      },
      include: subjectAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapSubjectAttributionToDTO);
  }

  async listBySubject(
    entityId: string,
    query: SubjectAttributionBySubjectQuery = {},
  ): Promise<SubjectAttributionDTO[]> {
    await this.assertEntityUnit(entityId);

    const rows = await prisma.subjectAttribution.findMany({
      where: {
        entityId,
        ...(query.role ? { role: query.role } : {}),
        unit: {
          ...(query.unitType ? { type: query.unitType as any } : {}),
          ...(query.status ? { status: query.status as any } : {}),
          ...(query.visibility ? { visibility: query.visibility as any } : {}),
        },
      },
      include: subjectAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapSubjectAttributionToDTO);
  }
}

export const subjectAttributionService = new SubjectAttributionService();
