import type { Static } from "elysia";
import { t } from "elysia";
import { TagRefSchema } from "../common/tag-ref";
import { contentDocSchema } from "../content/doc-v1";
import { gameSystemRequirementSummarySchema } from "../game-media";
import { languageSchema } from "../language";
import { postKindLiterals } from "../post";
import { aiDisclosureModeSchema, contentRatingSchema } from "../unit";
import { unitWorkDisplayPolicySchema, unitWorkRoleSchema } from "../unit-work";

// ANCHOR: Content Search Document

export const ContentSearchDocumentSchema = t.Object({
  // Identity
  id: t.String(),
  type: t.String(),

  // Searchable text (denormalized from UnitTranslation)
  titles: t.Array(t.String()),
  subtitles: t.Array(t.String()),
  contentText: t.Union([t.String(), t.Null()]),
  descriptionText: t.Union([t.String(), t.Null()]),
  summaries: t.Array(t.String()),
  descriptions: t.Array(t.String()),

  // Searchable credit attribution (denormalized from Attribution -> Entity translations)
  creditNames: t.Array(t.String()),

  // Searchable subject attribution (denormalized from SubjectAttribution -> Entity translations)
  subjectNames: t.Array(t.String()),
  subjectEntityIds: t.Array(t.String()),
  subjectKinds: t.Array(t.String()),
  subjectRoles: t.Array(t.String()),

  // Searchable tag labels (denormalized from tag Unit translations)
  tagLabels: t.Array(t.String()),

  // Searchable aliases (denormalized from UnitAlias.value, separate from titles)
  aliasValues: t.Array(t.String()),

  // Filterable: tag system (from UnitTag)
  tagIds: t.Array(t.String()),
  tagScores: t.Record(t.String(), t.Number()),

  // Filterable/display: work-domain projection (from UnitWork + inherited UnitTag)
  workUnitId: t.Union([t.String(), t.Null()]),
  searchGroupId: t.String(),
  ownTagIds: t.Array(t.String()),
  workTagIds: t.Array(t.String()),
  allTagIds: t.Array(t.String()),
  ownTagLabels: t.Array(t.String()),
  workTagLabels: t.Array(t.String()),
  allTagLabels: t.Array(t.String()),
  position: t.Union([t.String(), t.Null()]),
  displayPolicy: t.Union([unitWorkDisplayPolicySchema, t.Null()]),

  // Generic work-domain memberships for non-release content.
  workUnitIds: t.Array(t.String()),
  workRoles: t.Array(unitWorkRoleSchema),

  // Direct public Series metadata projected from SeriesContentIndex rows.
  seriesUnitIds: t.Array(t.String()),
  seriesKindKeys: t.Array(t.String()),
  seriesTitles: t.Array(t.String()),

  // GAME/MEDIA release metadata.
  platformEntityIds: t.Optional(t.Array(t.String())),
  ratingTagUnitIds: t.Optional(t.Array(t.String())),
  gameSystemRequirementSummaries: t.Optional(
    t.Array(gameSystemRequirementSummarySchema),
  ),
  gameReleaseDate: t.Optional(t.Union([t.String(), t.Null()])),
  gameVersionLabel: t.Optional(t.Union([t.String(), t.Null()])),
  mediaKindKey: t.Optional(t.Union([t.String(), t.Null()])),
  mediaReleaseDate: t.Optional(t.Union([t.String(), t.Null()])),
  mediaRuntimeMinutes: t.Optional(t.Union([t.Number(), t.Null()])),
  mediaEpisodeCount: t.Optional(t.Union([t.Number(), t.Null()])),
  mediaSeasonCount: t.Optional(t.Union([t.Number(), t.Null()])),
  mediaContentStructureAvailable: t.Optional(t.Boolean()),

  // Filterable: realm system (from UnitRealm)
  realmIds: t.Array(t.String()),

  // Filterable: multilingual wiki grouping (from Unit.translationGroupId)
  translationGroupId: t.Union([t.String(), t.Null()]),

  // Filterable: realm-tag system (from RealmTagApplication). Values are machine
  // filter keys formatted as "{realmUnitId}:{tagUnitId}", not display labels.
  realmTagKeys: t.Array(t.String()),

  // Filterable: shelf membership (only populated for type === "SHELF" documents)
  containedUnitIds: t.Optional(t.Array(t.String())),

  // Filterable: metadata
  languages: t.Array(t.String()),
  rating: contentRatingSchema,
  aiDisclosureMode: aiDisclosureModeSchema,
  visibility: t.String(),
  isLicensed: t.Boolean(),

  // Filterable: post kind (null for non-POST units)
  postKind: t.Union([postKindLiterals, t.Null()]),

  // Filterable: text length (null for non-book units)
  textLength: t.Union([t.Number(), t.Null()]),

  // Sortable
  createdAt: t.String(),
  updatedAt: t.String(),
  publishedAt: t.Union([t.String(), t.Null()]),
  hotScore: t.Number(),
  topScore: t.Number(),
  trendingScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),

  // Result display fields
  defaultLanguage: t.Union([languageSchema, t.Null()]),
  coverUrl: t.Union([t.String(), t.Null()]),
  userId: t.Union([t.String(), t.Null()]),

  // Link-specific display fields
  linkUrl: t.Optional(t.Union([t.String(), t.Null()])),
  linkSiteName: t.Optional(t.Union([t.String(), t.Null()])),

  // Grouped release search display fields
  collapsedAlternativeUnitIds: t.Optional(t.Array(t.String())),
  collapsedAlternatives: t.Optional(t.Array(t.Any())),

  // Structured translations for language-aware rendering
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Union([t.String(), t.Null()]),
        subtitle: t.Union([t.String(), t.Null()]),
        summary: t.Union([t.String(), t.Null()]),
        description: t.Union([contentDocSchema, t.Null()]),
      }),
    ),
  ),
});

export type ContentSearchDocument = Static<typeof ContentSearchDocumentSchema>;

// ANCHOR: Content Search Options

export const ContentSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  userId: t.Optional(t.String()),
  postKind: t.Optional(t.Array(postKindLiterals)),
  tags: t.Optional(t.Array(TagRefSchema)),
  tagIds: t.Optional(t.Array(t.String())),
  allTagIds: t.Optional(t.Array(t.String())),
  workUnitId: t.Optional(t.String()),
  searchGroupId: t.Optional(t.String()),
  workRoles: t.Optional(t.Array(unitWorkRoleSchema)),
  containedUnitIds: t.Optional(t.Array(t.String())),
  seriesUnitIds: t.Optional(t.Array(t.String())),
  seriesKindKeys: t.Optional(t.Array(t.String())),
  platformEntityIds: t.Optional(t.Array(t.String())),
  subjectEntityIds: t.Optional(t.Array(t.String())),
  subjectKinds: t.Optional(t.Array(t.String())),
  subjectRoles: t.Optional(t.Array(t.String())),
  releasePresentation: t.Optional(
    t.Union([t.Literal("grouped"), t.Literal("expanded")]),
  ),
  realmId: t.Optional(t.String()),
  realmTagIds: t.Optional(t.Array(t.String())),
  translationGroupIds: t.Optional(t.Array(t.String())),
  languages: t.Optional(t.Array(t.String())),
  ratings: t.Optional(t.Array(contentRatingSchema)),
  aiDisclosureModes: t.Optional(t.Array(aiDisclosureModeSchema)),
  isLicensed: t.Optional(t.Boolean()),
  textLength: t.Optional(
    t.Object({
      min: t.Optional(t.Number()),
      max: t.Optional(t.Number()),
    }),
  ),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("publishedAt"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("trendingScore"),
        t.Literal("qualityScore"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type ContentSearchOptions = Static<typeof ContentSearchOptionsSchema>;

// ANCHOR: Content Search Result

export const ContentSearchResultSchema = t.Object({
  items: t.Array(ContentSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type ContentSearchResult = Static<typeof ContentSearchResultSchema>;
