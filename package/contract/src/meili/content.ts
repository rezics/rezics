import type { Static } from "elysia";
import { t } from "elysia";
import { TagRefSchema } from "../common/tag-ref";
import { contentDocSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import { readLanguageBodyBase } from "../list-query-base";
import { gameSystemRequirementSummarySchema } from "../media/game-media";
import { postKindLiterals } from "../post";
import {
  aiDisclosureModeSchema,
  catalogEntryKindSchema,
  contentRatingSchema,
} from "../unit/unit";

// ANCHOR: Content Search Document
// ANCHOR: 内容搜索文档

export const ContentSearchDocumentSchema = t.Object({
  // Identity
  // 标识。
  id: t.String(),
  type: t.String(),

  // Searchable text (denormalized from UnitTranslation)
  // 可搜索文本（从 UnitTranslation 反规范化而来）。
  titles: t.Array(t.String()),
  subtitles: t.Array(t.String()),
  contentText: t.Union([t.String(), t.Null()]),
  descriptionText: t.Union([t.String(), t.Null()]),
  summaries: t.Array(t.String()),
  descriptions: t.Array(t.String()),

  // Searchable credit attribution (denormalized from Attribution -> Entity translations)
  // 可搜索的署名归属（从 Attribution -> Entity 翻译反规范化而来）。
  creditNames: t.Array(t.String()),

  // Searchable subject attribution (denormalized from SubjectAttribution -> Entity translations)
  // 可搜索的主题归属（从 SubjectAttribution -> Entity 翻译反规范化而来）。
  subjectNames: t.Array(t.String()),
  subjectEntityIds: t.Array(t.String()),
  subjectKinds: t.Array(t.String()),
  subjectRoles: t.Array(t.String()),

  // Searchable tag labels (denormalized from tag Unit translations)
  // 可搜索的标签名称（从 tag Unit 翻译反规范化而来）。
  tagLabels: t.Array(t.String()),

  // Searchable aliases (denormalized from UnitAlias.value, separate from titles)
  // 可搜索的别名（从 UnitAlias.value 反规范化而来，与 titles 分开）。
  aliasValues: t.Array(t.String()),

  // Filterable: tag system (from UnitTag)
  // 可过滤：标签系统（来自 UnitTag）。
  tagIds: t.Array(t.String()),
  tagScores: t.Record(t.String(), t.Number()),

  // Native catalog identity plus the Unit's canonical weak target projection.
  // Variants require targetUnitId; non-variant Unit extensions may also carry it.
  // 原生目录标识，加上 Unit 的规范弱目标投影。
  // Variant 必须有 targetUnitId；非 Variant 的 Unit 扩展也可能携带它。
  catalogEntryKind: t.Union([catalogEntryKindSchema, t.Null()]),
  targetUnitId: t.Union([t.String(), t.Null()]),

  // Direct public Series metadata projected from SeriesContentIndex rows.
  // 从 SeriesContentIndex 行投影出的直接公开 Series 元数据。
  seriesUnitIds: t.Array(t.String()),
  seriesKindKeys: t.Array(t.String()),
  seriesTitles: t.Array(t.String()),

  // GAME/MEDIA release metadata.
  // GAME/MEDIA 发行元数据。
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
  // 可过滤：realm 系统（来自 UnitRealm）。
  realmIds: t.Array(t.String()),

  // Filterable: realm-tag system (from RealmTagApplication). Values are machine
  // filter keys formatted as "{realmUnitId}:{tagUnitId}", not display labels.
  // 可过滤：realm-tag 系统（来自 RealmTagApplication）。值是格式为
  // "{realmUnitId}:{tagUnitId}" 的机器过滤键，而非显示名称。
  realmTagKeys: t.Array(t.String()),

  // Filterable: shelf membership (only populated for type === "SHELF" documents)
  // 可过滤：书架成员关系（仅在 type === "SHELF" 文档中填充）。
  containedUnitIds: t.Optional(t.Array(t.String())),

  // Filterable: metadata
  // 可过滤：元数据。
  languages: t.Array(t.String()),
  isLanguageNeutral: t.Boolean(),
  supportLanguages: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        isPrimary: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
      }),
    ),
  ),
  rating: contentRatingSchema,
  aiDisclosureMode: aiDisclosureModeSchema,
  visibility: t.String(),
  isLicensed: t.Boolean(),

  // Filterable: post kind (null for non-POST units)
  // 可过滤：帖子类型（非 POST 单元为 null）。
  postKind: t.Union([postKindLiterals, t.Null()]),

  // Filterable: text length (null for non-book units)
  // 可过滤：文本长度（非书籍单元为 null）。
  textLength: t.Union([t.Number(), t.Null()]),

  // Sortable
  // 可排序。
  createdAt: t.String(),
  updatedAt: t.String(),
  publishedAt: t.Union([t.String(), t.Null()]),
  bestScore: t.Number(),
  hotScore: t.Number(),
  topScore: t.Number(),
  risingScore: t.Number(),
  controversyScore: t.Number(),
  trendingScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),
  referenceCount: t.Number(),
  shareCount: t.Number(),

  // Result display fields
  // 结果展示字段。
  resolvedLanguage: t.Optional(t.Union([languageSchema, t.Null()])),
  title: t.Optional(t.Union([t.String(), t.Null()])),
  subtitle: t.Optional(t.Union([t.String(), t.Null()])),
  summary: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.Union([contentDocSchema, t.Null()])),
  defaultLanguage: t.Union([languageSchema, t.Null()]),
  coverUrl: t.Union([t.String(), t.Null()]),
  userId: t.Union([t.String(), t.Null()]),

  // Link-specific display fields
  // 链接专用的展示字段。
  linkUrl: t.Optional(t.Union([t.String(), t.Null()])),
  linkSiteName: t.Optional(t.Union([t.String(), t.Null()])),

  // Grouped release search display fields
  // 分组发行搜索的展示字段。
  collapsedAlternativeUnitIds: t.Optional(t.Array(t.String())),
  collapsedAlternatives: t.Optional(t.Array(t.Any())),

  // Structured translations for language-aware rendering
  // 用于语言感知渲染的结构化翻译。
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
// ANCHOR: 内容搜索选项

export const ContentSearchOptionsSchema = t.Object({
  ...readLanguageBodyBase.properties,
  keyword: t.Optional(t.String()),
  type: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  userId: t.Optional(t.String()),
  postKind: t.Optional(t.Array(postKindLiterals)),
  tags: t.Optional(t.Array(TagRefSchema)),
  tagIds: t.Optional(t.Array(t.String())),
  catalogEntryKind: t.Optional(catalogEntryKindSchema),
  targetUnitId: t.Optional(t.String()),
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
        t.Literal("bestScore"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("risingScore"),
        t.Literal("controversyScore"),
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
// ANCHOR: 内容搜索结果

export const ContentSearchResultSchema = t.Object({
  items: t.Array(ContentSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type ContentSearchResult = Static<typeof ContentSearchResultSchema>;
