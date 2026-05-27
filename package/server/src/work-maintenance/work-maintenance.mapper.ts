import type { UnitTranslationDTO, WorkMaintenanceDTO } from "@rezics/contract";
import type { UnitTranslation } from "#/prisma/client";

export function mapWorkTranslationToDTO(
  tr: UnitTranslation,
): UnitTranslationDTO {
  return {
    unitId: tr.unitId,
    language: tr.language as UnitTranslationDTO["language"],
    title: tr.title ?? undefined,
    subtitle: tr.subtitle ?? undefined,
    summary: tr.summary ?? undefined,
    description: tr.description as UnitTranslationDTO["description"],
    extra: (tr.extra as Record<string, unknown>) ?? undefined,
    sourceUnitId: tr.sourceUnitId ?? undefined,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  };
}

export function mapWorkMaintenanceToDTO(row: {
  id: string;
  type: string;
  translations: UnitTranslation[];
  workMembers: { unitId: string }[];
}): WorkMaintenanceDTO {
  return {
    unitId: row.id,
    type: row.type,
    translations: row.translations.map(mapWorkTranslationToDTO),
    releaseUnitIds: row.workMembers.map((membership) => membership.unitId),
  };
}
