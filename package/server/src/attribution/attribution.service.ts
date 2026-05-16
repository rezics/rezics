import type { AttributionDTO, LinkAttributionInput } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { patchContentCreditsToMeili } from "@/meili/content/sync";
import { mapAttributionToDTO } from "./attribution.mapper";
import { attributionInclude } from "./types";

export class AttributionService {
  // --- Attribution link/unlink ---

  async linkAttribution(req: LinkAttributionInput): Promise<AttributionDTO> {
    const row = await prisma.attribution.create({
      data: {
        unitId: req.unitId,
        entityId: req.entityId,
        role: req.role,
        sortOrder: req.sortOrder ?? 0,
      },
      include: attributionInclude,
    });
    await patchContentCreditsToMeili(req.unitId);
    return mapAttributionToDTO(row);
  }

  async unlinkAttribution(
    unitId: string,
    entityId: string,
    role: string,
  ): Promise<void> {
    await prisma.attribution.delete({
      where: {
        unitId_entityId_role: { unitId, entityId, role },
      },
    });
    await patchContentCreditsToMeili(unitId);
  }

  async getAttributionsByUnit(unitId: string): Promise<AttributionDTO[]> {
    const rows = await prisma.attribution.findMany({
      where: { unitId },
      include: attributionInclude,
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map(mapAttributionToDTO);
  }
}

export const attributionService = new AttributionService();
