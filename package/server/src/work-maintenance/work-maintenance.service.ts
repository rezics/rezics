import type {
  UpsertWorkMaintenanceTranslationInput,
  WorkMaintenanceDTO,
} from "@rezics/contract";
import { prisma, UnitWorkRole } from "#/prisma/client";
import { translationService } from "@/unit";
import { AppError } from "@/utils/errors";
import { mapWorkMaintenanceToDTO } from "./work-maintenance.mapper";

export class WorkMaintenanceService {
  async get(unitId: string): Promise<WorkMaintenanceDTO> {
    const row = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        type: true,
        translations: true,
        workMembers: {
          where: { role: UnitWorkRole.RELEASE },
          select: { unitId: true },
          orderBy: { unitId: "asc" },
        },
      },
    });
    if (!row || row.workMembers.length === 0) {
      throw new AppError(404, "Work Unit not found", {
        code: "work_maintenance_not_found",
      });
    }
    return mapWorkMaintenanceToDTO(row);
  }

  async upsertTranslation(
    unitId: string,
    input: UpsertWorkMaintenanceTranslationInput,
  ): Promise<WorkMaintenanceDTO> {
    await this.get(unitId);
    await translationService.upsertTranslation(unitId, input.language, input);
    return this.get(unitId);
  }
}

export const workMaintenanceService = new WorkMaintenanceService();
