import type { TagUnitDTO, TagVisual, UnitTagDTO } from "@rezics/contract";
import type { TagWithTranslations, UnitTagWithRelations } from "./types";

/**
 * Resolve a display label from a tag Unit's translations.
 * Picks the first translation that has a title, optionally preferring the given language.
 */
function resolveLabel(
  translations: TagWithTranslations["translations"],
  language?: string,
): string | undefined {
  if (!translations || translations.length === 0) return undefined;
  if (language) {
    const match = translations.find((t) => t.language === language && t.title);
    if (match?.title) return match.title;
  }
  return translations.find((t) => t.title)?.title ?? undefined;
}

function readTagVisual(extra: unknown): TagVisual | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    return null;
  }
  const visual = (extra as { tagVisual?: unknown }).tagVisual;
  if (!visual || typeof visual !== "object" || Array.isArray(visual)) {
    return null;
  }
  const source = visual as Record<string, unknown>;
  const result: TagVisual = {};
  if (typeof source.color === "string") result.color = source.color;
  if (typeof source.avatarUrl === "string") result.avatarUrl = source.avatarUrl;
  if (typeof source.iconSvg === "string") result.iconSvg = source.iconSvg;
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Map a UnitTag junction row to the contract DTO.
 * Set `belowVisibilityThreshold` when surfacing rows below the regular-user
 * suppression threshold to admin/owner callers.
 */
export function mapUnitTagToDTO(
  unitTag: UnitTagWithRelations,
  options?: { belowVisibilityThreshold?: boolean; viewerVote?: number | null },
): UnitTagDTO {
  return {
    unitId: unitTag.unitId,
    tagUnitId: unitTag.tagUnitId,
    score: unitTag.score,
    voteCount: unitTag.voteCount,
    ...(options?.viewerVote != null ? { viewerVote: options.viewerVote } : {}),
    pinned: unitTag.pinned,
    position: unitTag.position ?? null,
    ...(options?.belowVisibilityThreshold
      ? { belowVisibilityThreshold: true }
      : {}),
    createdAt: unitTag.createdAt.toISOString(),
    updatedAt: unitTag.updatedAt.toISOString(),
  };
}

/**
 * Map a tag Unit (with translations) to a minimal DTO for listing.
 */
export function mapTagUnitToDTO(
  tag: TagWithTranslations,
  language?: string,
): TagUnitDTO {
  return {
    unitId: tag.id,
    slug: tag.slug ?? undefined,
    label: resolveLabel(tag.translations, language),
    visual: readTagVisual(tag.extra),
    translations: tag.translations.map((t) => ({
      language: t.language,
      title: t.title,
    })),
  };
}
