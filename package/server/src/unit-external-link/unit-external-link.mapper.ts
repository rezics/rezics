import type {
  ExternalLinkDisplayEntitySummary,
  UnitExternalLinkDTO,
} from "@rezics/contract";
import type { UnitTranslation } from "../db/schema";
import type {
  HydratedExternalLinkEntity,
  UnitExternalLinkWithRelations,
} from "./unit-external-link.types";

function displayNameFromTranslations(
  translations: readonly (typeof UnitTranslation.$inferSelect)[],
): string | null {
  return translations.find((translation) => translation.title)?.title ?? null;
}

export function mapExternalLinkEntitySummary(
  entity: HydratedExternalLinkEntity | null | undefined,
): ExternalLinkDisplayEntitySummary | null {
  if (!entity) return null;
  const name = displayNameFromTranslations(entity.unit.translations);
  if (!name) return null;
  return {
    unitId: entity.unitId,
    name,
    avatar: entity.avatar ?? null,
    verified: entity.verified,
  };
}

export function mapUnitExternalLinkToDTO(
  row: UnitExternalLinkWithRelations,
): UnitExternalLinkDTO {
  const sourceEntity = mapExternalLinkEntitySummary(row.sourceEntity);
  if (!sourceEntity) {
    throw new Error("UnitExternalLink source Entity hydration failed");
  }
  const label =
    displayNameFromTranslations(row.labelUnit?.translations ?? []) ??
    sourceEntity.name ??
    row.fallbackText ??
    row.url;

  return {
    id: row.id,
    unitId: row.unitId,
    sourceEntityUnitId: row.sourceEntityUnitId,
    url: row.url,
    normalizedUrl: row.normalizedUrl ?? undefined,
    role: row.role as UnitExternalLinkDTO["role"],
    label,
    labelUnitId: row.labelUnitId ?? undefined,
    fallbackText: row.fallbackText ?? undefined,
    sourceEntity,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
