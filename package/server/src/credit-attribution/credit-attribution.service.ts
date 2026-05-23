import type {
  CreditAttributionDTO,
  LinkCreditAttributionInput,
  RezicsSessionClaims,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { patchContentCreditsToMeili } from "@/meili/content/sync";
import { AppError } from "@/utils/errors";
import {
  assertCanEditCollaborativeMetadata,
  creditRolePatchPath,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { mapCreditAttributionToDTO } from "./credit-attribution.mapper";
import { creditAttributionInclude } from "./types";

export class CreditAttributionService {
  private async assertCreditEligibility(req: LinkCreditAttributionInput) {
    const entity = await prisma.entity.findUnique({
      where: { unitId: req.entityId },
      select: { eligibleCreditRoles: true },
    });

    if (!entity) {
      throw new AppError(404, "Credit Entity not found", {
        code: "credit_entity_not_found",
        details: { entityId: req.entityId },
      });
    }

    if (!entity.eligibleCreditRoles.includes(req.role)) {
      throw new AppError(400, "Entity is not eligible for credit role", {
        code: "credit_entity_role_ineligible",
        details: { entityId: req.entityId, role: req.role },
      });
    }
  }

  async link(
    req: LinkCreditAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<CreditAttributionDTO> {
    const patchPath = creditRolePatchPath(req.role);
    await this.assertCreditEligibility(req);

    if (!actor) {
      const row = await prisma.creditAttribution.create({
        data: {
          unitId: req.unitId,
          entityId: req.entityId,
          role: req.role,
          sortOrder: req.sortOrder ?? 0,
        },
        include: creditAttributionInclude,
      });
      await patchContentCreditsToMeili(req.unitId);
      return mapCreditAttributionToDTO(row);
    }

    const row = await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, req.unitId, [
        patchPath,
      ]);
      const created = await tx.creditAttribution.create({
        data: {
          unitId: req.unitId,
          entityId: req.entityId,
          role: req.role,
          sortOrder: req.sortOrder ?? 0,
        },
        include: creditAttributionInclude,
      });
      await writeEditorialMetadataHistory(tx as any, {
        unitId: req.unitId,
        actorUserId: actor.userId,
        patch: {
          credits: {
            [patchPath.slice("credits.".length)]: [
              {
                entityId: req.entityId,
                role: req.role,
                sortOrder: req.sortOrder ?? 0,
              },
            ],
          },
        },
        message: "credit-attribution.link",
      });
      return created;
    });
    await patchContentCreditsToMeili(req.unitId);
    return mapCreditAttributionToDTO(row);
  }

  async unlink(
    unitId: string,
    entityId: string,
    role: string,
    actor?: RezicsSessionClaims,
  ): Promise<void> {
    const patchPath = creditRolePatchPath(role);

    if (!actor) {
      await prisma.creditAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await patchContentCreditsToMeili(unitId);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, unitId, [
        patchPath,
      ]);
      await tx.creditAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await writeEditorialMetadataHistory(tx as any, {
        unitId,
        actorUserId: actor.userId,
        patch: { $unset: [patchPath] },
        message: "credit-attribution.unlink",
      });
    });
    await patchContentCreditsToMeili(unitId);
  }

  async listByUnit(unitId: string): Promise<CreditAttributionDTO[]> {
    const rows = await prisma.creditAttribution.findMany({
      where: { unitId },
      include: creditAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapCreditAttributionToDTO);
  }
}

export const creditAttributionService = new CreditAttributionService();
