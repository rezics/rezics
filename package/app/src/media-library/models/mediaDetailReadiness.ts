import { contentSearchQueryOptions, contentStructureQuery } from "@rezics/api";

export const mediaDetailTabs = [
  "overview",
  "content",
  "releases",
  "community",
  "metadata",
] as const;

export type MediaDetailTab = (typeof mediaDetailTabs)[number];

export const mediaDetailHeroRegions = [
  "poster",
  "release-metadata",
  "primary-actions",
  "domain-media",
] as const;

export function mediaDetailData(unitId: string) {
  return {
    releaseSearch: contentSearchQueryOptions({
      type: "MEDIA",
      searchGroupId: unitId,
      releasePresentation: "expanded",
      limit: 1,
    }),
    contentStructure: contentStructureQuery(unitId),
  };
}

export const mediaDetailDomainMediaPolicy = {
  heroRegion: "domain-media",
  sources: ["UnitExternalRef", "ContentDoc", "future-typed-media-asset"],
  excludedMediaColumns: [
    "trailerUrl",
    "clipUrls",
    "screenshotUrls",
    "carouselUrls",
  ],
} as const;
