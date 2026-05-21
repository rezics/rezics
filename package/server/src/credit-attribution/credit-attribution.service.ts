import type {
  CreditAttributionDTO,
  LinkCreditAttributionInput,
  RezicsSessionClaims,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { patchContentCreditsToMeili } from "@/meili/content/sync";
import { patchEntityCreditFacetsToMeili } from "@/meili/entity/sync";
import {
  assertCanEditCollaborativeMetadata,
  creditRoleFieldKey,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { mapCreditAttributionToDTO } from "./credit-attribution.mapper";
import { creditAttributionInclude } from "./types";

export class CreditAttributionService {
  async link(
    req: LinkCreditAttributionInput,
    actor?: RezicsSessionClaims,
  ): Promise<CreditAttributionDTO> {
    const fieldKey = creditRoleFieldKey(req.role);

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
      await patchEntityCreditFacetsToMeili(req.entityId);
      return mapCreditAttributionToDTO(row);
    }

    const row = await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, req.unitId, [
        fieldKey,
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
        changedFieldKeys: [fieldKey],
        message: "credit-attribution.link",
      });
      return created;
    });
    await patchContentCreditsToMeili(req.unitId);
    await patchEntityCreditFacetsToMeili(req.entityId);
    return mapCreditAttributionToDTO(row);
  }

  async unlink(
    unitId: string,
    entityId: string,
    role: string,
    actor?: RezicsSessionClaims,
  ): Promise<void> {
    const fieldKey = creditRoleFieldKey(role);

    if (!actor) {
      await prisma.creditAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await patchContentCreditsToMeili(unitId);
      await patchEntityCreditFacetsToMeili(entityId);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await assertCanEditCollaborativeMetadata(tx as any, actor, unitId, [
        fieldKey,
      ]);
      await tx.creditAttribution.delete({
        where: {
          unitId_entityId_role: { unitId, entityId, role },
        },
      });
      await writeEditorialMetadataHistory(tx as any, {
        unitId,
        actorUserId: actor.userId,
        changedFieldKeys: [fieldKey],
        message: "credit-attribution.unlink",
      });
    });
    await patchContentCreditsToMeili(unitId);
    await patchEntityCreditFacetsToMeili(entityId);
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
