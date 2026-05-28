import {
  RATING_TAGS,
  type GameLibraryContentDTO,
  type GameSystemRequirementSummary,
  type MediaLibraryContentDTO,
} from "@rezics/contract";
import { buildContentStructureTree } from "@/content-structure/mapper";
import type { GameLibraryRow, MediaLibraryRow } from "./types";

const RATING_TAG_SLUGS = new Set<string>(RATING_TAGS);

function releaseMembership(unit: {
  workMemberships?: Array<{
    unitId: string;
    workUnitId: string;
    role: string;
    language: string | null;
    position: string | null;
    displayPolicy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  return unit.workMemberships?.[0] ?? null;
}

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
  const membership = releaseMembership(row.unit);
  const workUnitId = membership?.workUnitId ?? null;
  const contentStructure = row.unit.ownedContentStructure;

  return {
    unitId: row.unitId,
    workUnitId,
    metadata: { uswn: workUnitId },
    translations: row.unit.translations,
    workMembership: membership
      ? {
          unitId: membership.unitId,
          workUnitId: membership.workUnitId,
          role: membership.role as any,
          language: membership.language as any,
          position: membership.position,
          displayPolicy: membership.displayPolicy as any,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        }
      : null,
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
  const membership = releaseMembership(row.unit);
  const workUnitId = membership?.workUnitId ?? null;
  const contentStructure = row.unit.ownedContentStructure;

  return {
    unitId: row.unitId,
    workUnitId,
    metadata: { uswn: workUnitId },
    translations: row.unit.translations,
    workMembership: membership
      ? {
          unitId: membership.unitId,
          workUnitId: membership.workUnitId,
          role: membership.role as any,
          language: membership.language as any,
          position: membership.position,
          displayPolicy: membership.displayPolicy as any,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        }
      : null,
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
