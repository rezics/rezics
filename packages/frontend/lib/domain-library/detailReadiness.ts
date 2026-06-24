export type DomainReleaseType = "GAME" | "MEDIA";

export type DomainReleaseSearchRequest = Readonly<{
  type: DomainReleaseType;
  catalogEntryKind: "VARIANT";
  targetUnitId: string;
  releasePresentation: "expanded";
  limit: 1;
}>;

export type ReleaseSearchDescriptor = Readonly<{
  method: "POST";
  path: "/meili/content/search";
  body: DomainReleaseSearchRequest;
  swrKey: readonly [
    "eden",
    "POST",
    "/meili/content/search",
    DomainReleaseSearchRequest,
  ];
}>;

export type ContentStructureDescriptor = Readonly<{
  method: "GET";
  path: "/content-structure/:ownerUnitId";
  params: Readonly<{
    ownerUnitId: string;
  }>;
  swrKey: readonly [
    "eden",
    "GET",
    "/content-structure/:ownerUnitId",
    string,
  ];
}>;

export type GameSystemRequirementsDescriptor = Readonly<{
  method: "GET";
  path: "/game-system-requirement";
  query: Readonly<{
    gameUnitId: string;
  }>;
  swrKey: readonly [
    "eden",
    "GET",
    "/game-system-requirement",
    Readonly<{ gameUnitId: string }>,
  ];
}>;

export type GameDetailDataDescriptor = Readonly<{
  releaseSearch: ReleaseSearchDescriptor;
  contentStructure: ContentStructureDescriptor;
  systemRequirements: GameSystemRequirementsDescriptor;
}>;

export type MediaDetailDataDescriptor = Readonly<{
  releaseSearch: ReleaseSearchDescriptor;
  contentStructure: ContentStructureDescriptor;
}>;

export const gameDetailTabs = [
  "overview",
  "content",
  "releases",
  "community",
  "metadata",
] as const;

export type GameDetailTab = (typeof gameDetailTabs)[number];

export const mediaDetailTabs = [
  "overview",
  "content",
  "releases",
  "community",
  "metadata",
] as const;

export type MediaDetailTab = (typeof mediaDetailTabs)[number];

export const gameDetailHeroRegions = [
  "key-art",
  "release-metadata",
  "primary-actions",
  "domain-media",
] as const;

export const mediaDetailHeroRegions = [
  "poster",
  "release-metadata",
  "primary-actions",
  "domain-media",
] as const;

export const gameDetailDomainMediaPolicy = {
  heroRegion: "domain-media",
  sources: ["UnitExternalLink", "ContentDoc", "future-typed-media-asset"],
  excludedGameColumns: ["trailerUrl", "screenshotUrls", "carouselUrls"],
} as const;

export const mediaDetailDomainMediaPolicy = {
  heroRegion: "domain-media",
  sources: ["UnitExternalLink", "ContentDoc", "future-typed-media-asset"],
  excludedMediaColumns: [
    "trailerUrl",
    "clipUrls",
    "screenshotUrls",
    "carouselUrls",
  ],
} as const;

function releaseSearchDescriptor(
  type: DomainReleaseType,
  unitId: string,
): ReleaseSearchDescriptor {
  const body = {
    type,
    catalogEntryKind: "VARIANT",
    targetUnitId: unitId,
    releasePresentation: "expanded",
    limit: 1,
  } as const;

  return {
    method: "POST",
    path: "/meili/content/search",
    body,
    swrKey: ["eden", "POST", "/meili/content/search", body] as const,
  };
}

function contentStructureDescriptor(unitId: string): ContentStructureDescriptor {
  return {
    method: "GET",
    path: "/content-structure/:ownerUnitId",
    params: { ownerUnitId: unitId },
    swrKey: [
      "eden",
      "GET",
      "/content-structure/:ownerUnitId",
      unitId,
    ] as const,
  };
}

function gameSystemRequirementsDescriptor(
  gameUnitId: string,
): GameSystemRequirementsDescriptor {
  const query = { gameUnitId } as const;

  return {
    method: "GET",
    path: "/game-system-requirement",
    query,
    swrKey: ["eden", "GET", "/game-system-requirement", query] as const,
  };
}

export function gameDetailData(unitId: string): GameDetailDataDescriptor {
  return {
    releaseSearch: releaseSearchDescriptor("GAME", unitId),
    contentStructure: contentStructureDescriptor(unitId),
    systemRequirements: gameSystemRequirementsDescriptor(unitId),
  };
}

export function mediaDetailData(unitId: string): MediaDetailDataDescriptor {
  return {
    releaseSearch: releaseSearchDescriptor("MEDIA", unitId),
    contentStructure: contentStructureDescriptor(unitId),
  };
}
