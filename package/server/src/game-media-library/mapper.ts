import {
  type GameLibraryContentDTO,
  type GameSystemRequirementSummary,
  type MediaLibraryContentDTO,
  RATING_TAGS,
} from "@rezics/contract";
import { buildContentStructureTree } from "@/content-structure/mapper";
import type { GameLibraryRow, MediaLibraryRow } from "./types";

const RATING_TAG_SLUGS = new Set<string>(RATING_TAGS);

function ratingTagUnitIds(unit: {
  unitTags?: Array<{ tagUnitId: string; tag?: { slug: string | null } }>;
}): string[] {
  return (
    unit.unitTags
      ?.filter((link) => link.tag?.slug && RATING_TAG_SLUGS.has(link.tag.slug))
      .map((link) => link.tagUnitId) ?? []
  );
}

function mapRequirementSummary(row: {
  platformEntityId: string | null;
  tier: string;
  language: string | null;
  hardware: unknown;
}): GameSystemRequirementSummary {
  return {
    platformEntityId: row.platformEntityId,
    tier: row.tier as GameSystemRequirementSummary["tier"],
    language: row.language as GameSystemRequirementSummary["language"],
    hardware: row.hardware as GameSystemRequirementSummary["hardware"],
  };
}

export function mapGameLibraryContentToDTO(
  row: GameLibraryRow,
): GameLibraryContentDTO {
  const contentStructure = row.unit.ownedContentStructure;

  return {
    unitId: row.unitId,
    translations: row.unit
      .translations as GameLibraryContentDTO["translations"],
    contentStructure: contentStructure
      ? {
          ownerUnitId: contentStructure.ownerUnitId,
          nodes: buildContentStructureTree(contentStructure.contentNodes),
          createdAt: contentStructure.createdAt,
          updatedAt: contentStructure.updatedAt,
        }
      : null,
    game: {
      platformEntityIds: row.unit.subjectAttributions.map(
        (link) => link.entityId,
      ),
      ageRatingTagUnitIds: ratingTagUnitIds(row.unit),
      systemRequirementSummaries: row.systemRequirements.map(
        mapRequirementSummary,
      ),
    },
  };
}

export function mapMediaLibraryContentToDTO(
  row: MediaLibraryRow,
): MediaLibraryContentDTO {
  const contentStructure = row.unit.ownedContentStructure;

  return {
    unitId: row.unitId,
    translations: row.unit
      .translations as MediaLibraryContentDTO["translations"],
    contentStructure: contentStructure
      ? {
          ownerUnitId: contentStructure.ownerUnitId,
          nodes: buildContentStructureTree(contentStructure.contentNodes),
          createdAt: contentStructure.createdAt,
          updatedAt: contentStructure.updatedAt,
        }
      : null,
    media: {
      ageRatingTagUnitIds: ratingTagUnitIds(row.unit),
      contentStructureAvailable: Boolean(contentStructure),
      runtimeMinutes: row.runtimeMinutes,
      kindKey: row.kindKey,
    },
  };
}
