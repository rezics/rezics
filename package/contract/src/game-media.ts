import { t } from "elysia";
import { contentStructureDTOSchema } from "./content-structure";
import { languageSchema } from "./language";
import { unitTranslationDTOSchema } from "./unit";
import { unitWorkDTOSchema } from "./unit-work";

export const RATING_TAGS = [
  "esrb-everyone",
  "esrb-everyone-10",
  "esrb-teen",
  "esrb-mature",
  "esrb-adults-only",
  "pegi-3",
  "pegi-7",
  "pegi-12",
  "pegi-16",
  "pegi-18",
  "cero-a",
  "cero-b",
  "cero-c",
  "cero-d",
  "cero-z",
  "mpaa-g",
  "mpaa-pg",
  "mpaa-pg-13",
  "mpaa-r",
  "mpaa-nc-17",
  "tv-y",
  "tv-y7",
  "tv-g",
  "tv-pg",
  "tv-14",
  "tv-ma",
] as const;

export type RatingTagSlug = (typeof RATING_TAGS)[number];

export const ratingTagSlugSchema = t.Union(
  RATING_TAGS.map((slug) => t.Literal(slug)) as [
    ReturnType<typeof t.Literal<RatingTagSlug>>,
    ReturnType<typeof t.Literal<RatingTagSlug>>,
    ...ReturnType<typeof t.Literal<RatingTagSlug>>[],
  ],
);

export const gameSystemRequirementTierSchema = t.Union([
  t.Literal("minimum"),
  t.Literal("recommended"),
]);

export type GameSystemRequirementTier =
  (typeof gameSystemRequirementTierSchema)["static"];

export const gameSystemRequirementHardwareSchema = t.Object(
  {
    cpuSlugs: t.Optional(t.Array(t.String())),
    gpuSlugs: t.Optional(t.Array(t.String())),
    memory: t.Optional(t.String()),
    vram: t.Optional(t.String()),
    storage: t.Optional(t.String()),
    os: t.Optional(t.String()),
    graphicsApiSlugs: t.Optional(t.Array(t.String())),
    notes: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type GameSystemRequirementHardware =
  (typeof gameSystemRequirementHardwareSchema)["static"];

export const gameSystemRequirementSummarySchema = t.Object({
  platformEntityId: t.Optional(t.Nullable(t.String())),
  tier: gameSystemRequirementTierSchema,
  language: t.Optional(t.Nullable(languageSchema)),
  hardware: gameSystemRequirementHardwareSchema,
});

export type GameSystemRequirementSummary =
  (typeof gameSystemRequirementSummarySchema)["static"];

export const gameSystemRequirementDTOSchema = t.Object({
  id: t.String(),
  gameUnitId: t.String(),
  platformEntityId: t.Optional(t.Nullable(t.String())),
  tier: gameSystemRequirementTierSchema,
  language: t.Optional(t.Nullable(languageSchema)),
  sourceRefId: t.Optional(t.Nullable(t.String())),
  hardware: gameSystemRequirementHardwareSchema,
  rawText: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type GameSystemRequirementDTO =
  (typeof gameSystemRequirementDTOSchema)["static"];

export const gameSystemRequirementParamsSchema = t.Object({
  id: t.String(),
});

export type GameSystemRequirementParams =
  (typeof gameSystemRequirementParamsSchema)["static"];

export const createGameSystemRequirementSchema = t.Object({
  gameUnitId: t.String(),
  platformEntityId: t.Optional(t.Nullable(t.String())),
  tier: gameSystemRequirementTierSchema,
  language: t.Optional(t.Nullable(languageSchema)),
  sourceRefId: t.Optional(t.Nullable(t.String())),
  hardware: gameSystemRequirementHardwareSchema,
  rawText: t.Optional(t.Nullable(t.String())),
});

export type CreateGameSystemRequirementInput =
  (typeof createGameSystemRequirementSchema)["static"];

export const updateGameSystemRequirementSchema = t.Object({
  platformEntityId: t.Optional(t.Nullable(t.String())),
  tier: t.Optional(gameSystemRequirementTierSchema),
  language: t.Optional(t.Nullable(languageSchema)),
  sourceRefId: t.Optional(t.Nullable(t.String())),
  hardware: t.Optional(gameSystemRequirementHardwareSchema),
  rawText: t.Optional(t.Nullable(t.String())),
});

export type UpdateGameSystemRequirementInput =
  (typeof updateGameSystemRequirementSchema)["static"];

export const gameSystemRequirementListFiltersSchema = t.Object({
  gameUnitId: t.Optional(t.String()),
  platformEntityId: t.Optional(t.Nullable(t.String())),
  tier: t.Optional(gameSystemRequirementTierSchema),
  language: t.Optional(languageSchema),
  sourceRefId: t.Optional(t.String()),
});

export type GameSystemRequirementListFilters =
  (typeof gameSystemRequirementListFiltersSchema)["static"];

export const gameSystemRequirementListResponseSchema = t.Object({
  requirements: t.Array(gameSystemRequirementDTOSchema),
});

export type GameSystemRequirementListResponse =
  (typeof gameSystemRequirementListResponseSchema)["static"];

export const gameLibraryContentMetadataSchema = t.Object({
  platformEntityIds: t.Array(t.String()),
  ageRatingTagUnitIds: t.Array(t.String()),
  systemRequirementSummaries: t.Array(gameSystemRequirementSummarySchema),
});

export type GameLibraryContentMetadata =
  (typeof gameLibraryContentMetadataSchema)["static"];

export const mediaLibraryContentMetadataSchema = t.Object({
  ageRatingTagUnitIds: t.Array(t.String()),
  contentStructureAvailable: t.Boolean(),
  runtimeMinutes: t.Optional(t.Nullable(t.Number())),
  kindKey: t.Optional(t.Nullable(t.String())),
});

export type MediaLibraryContentMetadata =
  (typeof mediaLibraryContentMetadataSchema)["static"];

export const gameLibraryContentDTOSchema = t.Object({
  unitId: t.String(),
  workUnitId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(
    t.Object({
      uswn: t.Union([t.String(), t.Null()]),
    }),
  ),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  workMembership: t.Optional(t.Nullable(unitWorkDTOSchema)),
  contentStructure: t.Optional(t.Nullable(contentStructureDTOSchema)),
  game: gameLibraryContentMetadataSchema,
});

export type GameLibraryContentDTO =
  (typeof gameLibraryContentDTOSchema)["static"];

export const mediaLibraryContentDTOSchema = t.Object({
  unitId: t.String(),
  workUnitId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(
    t.Object({
      uswn: t.Union([t.String(), t.Null()]),
    }),
  ),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  workMembership: t.Optional(t.Nullable(unitWorkDTOSchema)),
  contentStructure: t.Optional(t.Nullable(contentStructureDTOSchema)),
  media: mediaLibraryContentMetadataSchema,
});

export type MediaLibraryContentDTO =
  (typeof mediaLibraryContentDTOSchema)["static"];
