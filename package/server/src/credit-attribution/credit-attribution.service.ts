import type {
  CreditAttributionDTO,
  LinkCreditAttributionInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { patchContentCreditsToMeili } from "@/meili/content/sync";
import { mapCreditAttributionToDTO } from "./credit-attribution.mapper";
import { creditAttributionInclude } from "./types";

export class CreditAttributionService {
  async link(req: LinkCreditAttributionInput): Promise<CreditAttributionDTO> {
    const row = await prisma.attribution.create({
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

  async unlink(unitId: string, entityId: string, role: string): Promise<void> {
    await prisma.attribution.delete({
      where: {
        unitId_entityId_role: { unitId, entityId, role },
      },
    });
    await patchContentCreditsToMeili(unitId);
  }

  async listByUnit(unitId: string): Promise<CreditAttributionDTO[]> {
    const rows = await prisma.attribution.findMany({
      where: { unitId },
      include: creditAttributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapCreditAttributionToDTO);
  }
}

export const creditAttributionService = new CreditAttributionService();
