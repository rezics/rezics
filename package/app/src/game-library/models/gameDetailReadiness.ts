import {
  contentSearchQueryOptions,
  contentStructureQuery,
  gameSystemRequirementsByGameQueryOptions,
} from "@rezics/api";

export const gameDetailTabs = [
  "overview",
  "content",
  "releases",
  "community",
  "metadata",
] as const;

export type GameDetailTab = (typeof gameDetailTabs)[number];

export const gameDetailHeroRegions = [
  "key-art",
  "release-metadata",
  "primary-actions",
  "domain-media",
] as const;

export function gameDetailData(unitId: string) {
  return {
    releaseSearch: contentSearchQueryOptions({
      type: "GAME",
      searchGroupId: unitId,
      releasePresentation: "expanded",
      limit: 1,
    }),
    contentStructure: contentStructureQuery(unitId),
    systemRequirements: gameSystemRequirementsByGameQueryOptions(unitId),
  };
}

export const gameDetailDomainMediaPolicy = {
  heroRegion: "domain-media",
  sources: ["UnitExternalRef", "ContentDoc", "future-typed-media-asset"],
  excludedGameColumns: ["trailerUrl", "screenshotUrls", "carouselUrls"],
} as const;
