import { t } from "elysia";
import {
  contentStructureNodeSchema,
  type ContentStructureItem,
} from "../content/structure";
import { languageSchema } from "../language";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  contentRatingSchema,
  publicUserSchema,
  unitTranslationDTOSchema,
} from "../unit/unit";

/**
 * Public-knowledge Series kinds.
 *
 * `franchise` represents brand, IP, publishing-lineage, or commercial grouping.
 * `universe` represents shared fictional continuity, setting, or world grouping.
 *
 * Internal partitions such as seasons, season groups, episode groups, volume
 * groups, disc groups, track groups, arcs, and source-specific orderings are
 * content-structure metadata, not Series kind values.
 */
export const seriesKindValues = [
  "book_series",
  "game_series",
  "film_series",
  "media_series",
  "franchise",
  "universe",
] as const;

export const seriesKindSchema = t.Union(
  seriesKindValues.map((value) => t.Literal(value)),
);

export type SeriesKind = (typeof seriesKindSchema)["static"];

export const seriesDTOSchema = t.Object({
  unitId: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  kindKey: seriesKindSchema,
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  licenseSlug: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type SeriesDTO = (typeof seriesDTOSchema)["static"];

export const seriesDetailDTOSchema = t.Object({
  ...seriesDTOSchema.properties,
  contentStructure: t.Optional(
    t.Object({
      ownerUnitId: t.String(),
      nodes: t.Array(contentStructureNodeSchema),
      createdAt: t.Union([t.String(), t.Date()]),
      updatedAt: t.Union([t.String(), t.Date()]),
    }),
  ),
  directReleaseCount: t.Optional(t.Number()),
});

export type SeriesDetailDTO = (typeof seriesDetailDTOSchema)["static"];

const seriesTranslationInputSchema = t.Object({
  language: languageSchema,
  title: t.Optional(t.String()),
  subtitle: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  description: t.Optional(t.Any()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.String()),
});

export const createSeriesSchema = t.Object({
  userId: t.Optional(t.String()),
  kindKey: seriesKindSchema,
  defaultLanguage: t.Optional(languageSchema),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  licenseSlug: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(t.Array(seriesTranslationInputSchema)),
});

export type CreateSeriesInput = (typeof createSeriesSchema)["static"];

export const updateSeriesSchema = t.Object({
  kindKey: t.Optional(seriesKindSchema),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  licenseSlug: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateSeriesInput = (typeof updateSeriesSchema)["static"];

export const seriesListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  kindKey: t.Optional(seriesKindSchema),
  containsReleaseUnitId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  start: t.Optional(t.Number()),
  limit: paginationLimitSchema,
});

export type SeriesListQuery = (typeof seriesListQuerySchema)["static"];

export const seriesListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  q: t.Optional(t.String()),
  kindKey: t.Optional(seriesKindSchema),
  containsReleaseUnitId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  start: t.Optional(t.Number()),
  limit: paginationLimitSchema,
});

export type SeriesListBody = (typeof seriesListBodySchema)["static"];

export const seriesListResponseSchema = t.Object({
  series: t.Array(seriesDTOSchema),
  total: t.Optional(t.Number()),
});

export type SeriesListResponse = (typeof seriesListResponseSchema)["static"];

export const seriesParamsSchema = t.Object({
  unitId: t.String(),
});

export type SeriesParams = (typeof seriesParamsSchema)["static"];

export const seriesResponseSchema = seriesDTOSchema;
export type SeriesResponse = (typeof seriesResponseSchema)["static"];

export const seriesReleaseUnitTypeSchema = t.Union([
  t.Literal("BOOK"),
  t.Literal("GAME"),
  t.Literal("MEDIA"),
]);

export type SeriesReleaseUnitType =
  (typeof seriesReleaseUnitTypeSchema)["static"];

/**
 * Counted Series membership is release-first: this node points at a visible
 * release Unit, not a hidden Work Unit.
 */
export const seriesReleaseMemberNodeSchema = t.Object({
  ...contentStructureNodeSchema.properties,
  nodeKind: t.Literal("release_member"),
  contentUnitId: t.String(),
  contentUnitType: seriesReleaseUnitTypeSchema,
  contributesDirectReleaseMembership: t.Literal(true),
});

/**
 * Nested Series references are structural/cross-reference nodes only. They do
 * not recursively contribute inherited release membership, search projection,
 * or catalog projection.
 */
export const seriesNestedReferenceNodeSchema = t.Object({
  ...contentStructureNodeSchema.properties,
  nodeKind: t.Literal("nested_series_reference"),
  contentUnitId: t.String(),
  contentUnitType: t.Literal("SERIES"),
  contributesDirectReleaseMembership: t.Literal(false),
});

export const seriesContentNodeSchema = t.Union([
  seriesReleaseMemberNodeSchema,
  seriesNestedReferenceNodeSchema,
]);

export type SeriesContentNode = (typeof seriesContentNodeSchema)["static"];

export interface SeriesContentItem extends ContentStructureItem {
  nodeKind?: "release_member" | "nested_series_reference";
  contentUnitType?: SeriesReleaseUnitType | "SERIES";
  contributesDirectReleaseMembership?: boolean;
  children?: SeriesContentItem[];
}

export const seriesContentEligibilityHints = {
  countedReleaseMemberUnitTypes: ["BOOK", "GAME", "MEDIA"],
  nestedSeriesReferenceUnitTypes: ["SERIES"],
  directWorkUnitMembersAllowed: false,
  nestedSeriesReferencesAreTransitive: false,
} as const;

/**
 * Direct lookup projection from counted release member nodes. This row is not
 * hierarchy authority and intentionally has no path, depth, ordering,
 * parentage, inherited membership, or source-domain fields.
 */
export const seriesContentIndexDTOSchema = t.Object({
  seriesUnitId: t.String(),
  releaseUnitId: t.String(),
  contentNodeId: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type SeriesContentIndexDTO =
  (typeof seriesContentIndexDTOSchema)["static"];

export const seriesDiagnosticsDTOSchema = t.Object({
  seriesUnitId: t.String(),
  nestedSeriesReferenceUnitIds: t.Array(t.String()),
  weakDisplayReleaseUnitIds: t.Array(t.String()),
  missingTranslationReleaseUnitIds: t.Array(t.String()),
  missingSourceReleaseUnitIds: t.Array(t.String()),
});

export type SeriesDiagnosticsDTO =
  (typeof seriesDiagnosticsDTOSchema)["static"];
