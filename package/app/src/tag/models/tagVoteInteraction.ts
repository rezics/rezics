import type { BatchTagTranslationResult } from "@rezics/contract";
import type { InjectedTag } from "@/search";

export type TagVoteClickAction =
  | { kind: "vote"; value: 1 | -1 }
  | { kind: "withdraw" };

export function resolveTagVoteClickAction(
  viewerVote: number | null | undefined,
  value: 1 | -1,
): TagVoteClickAction {
  return viewerVote === value ? { kind: "withdraw" } : { kind: "vote", value };
}

export function tagSearchTarget(
  tagUnitId: string,
  translations: BatchTagTranslationResult,
  fallbackName: string,
): InjectedTag {
  return {
    unitId: tagUnitId,
    name: translations[tagUnitId]?.name || fallbackName,
    ...(translations[tagUnitId]?.slug
      ? { slug: translations[tagUnitId]?.slug }
      : {}),
  };
}
