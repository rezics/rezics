import type { Static } from "elysia";
import { t } from "elysia";
import { languageSchema } from "../language";
import { postKindLiterals } from "../post/post";
import { contentRatingSchema, unitTypeSchema } from "../unit/unit";
import { zoneLinkTargetSchema } from "./link-target";

// ANCHOR: Zone section query
// ANCHOR: 专区分区查询

/**
 * `ZoneSectionQuery` compiles only to fields the Meilisearch `content` /
 * `posts` indexes can filter or sort; the server-side compiler rejects
 * combinations outside that vocabulary (e.g. `tagUnitIds` on the posts
 * index). Semantic section variants ("latest", "popular", "recent wiki")
 * are query presets plus default-title i18n keys, never new section kinds.
 * `ZoneSectionQuery` 只编译为 Meilisearch `content` / `posts` 索引可
 * 过滤或排序的字段；服务端编译器会拒绝词汇表之外的组合（例如 posts
 * 索引上的 `tagUnitIds`）。语义化的分区变体（“最新”“热门”“最近 wiki”）
 * 是查询预设加默认标题 i18n key，绝不是新的分区 kind。
 */
export const zoneSectionQueryRealmSchema = t.Union([
  // "context" resolves to `config.context` at execution time.
  // "context" 在执行时解析为 `config.context`。
  t.Literal("context"),
  t.Object(
    {
      unitIds: t.Array(t.String()),
    },
    { additionalProperties: false },
  ),
]);

export type ZoneSectionQueryRealm = Static<typeof zoneSectionQueryRealmSchema>;

/**
 * "viewer" resolves to the reader's language candidate chain at execution
 * time.
 * "viewer" 在执行时解析为读者的语言候选链。
 */
export const zoneSectionQueryLanguagesSchema = t.Union([
  t.Literal("viewer"),
  t.Array(languageSchema),
]);

export type ZoneSectionQueryLanguages = Static<
  typeof zoneSectionQueryLanguagesSchema
>;

export const zoneSectionQuerySortFieldSchema = t.Union([
  t.Literal("createdAt"),
  t.Literal("updatedAt"),
  t.Literal("publishedAt"),
  t.Literal("replyCount"),
  t.Literal("bestScore"),
  t.Literal("hotScore"),
  t.Literal("topScore"),
  t.Literal("risingScore"),
  t.Literal("controversyScore"),
  t.Literal("trendingScore"),
  t.Literal("qualityScore"),
]);

export type ZoneSectionQuerySortField = Static<
  typeof zoneSectionQuerySortFieldSchema
>;

export const zoneSectionQuerySortSchema = t.Object(
  {
    field: zoneSectionQuerySortFieldSchema,
    direction: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  },
  { additionalProperties: false },
);

export type ZoneSectionQuerySort = Static<typeof zoneSectionQuerySortSchema>;

export const zoneSectionQuerySubjectsSchema = t.Object(
  {
    entityUnitIds: t.Optional(t.Array(t.String())),
    roles: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export type ZoneSectionQuerySubjects = Static<
  typeof zoneSectionQuerySubjectsSchema
>;

export const zoneSectionQuerySchema = t.Object(
  {
    target: t.Union([t.Literal("unit"), t.Literal("post")]),
    types: t.Optional(t.Array(unitTypeSchema)),
    postKinds: t.Optional(t.Array(postKindLiterals)),
    realm: t.Optional(zoneSectionQueryRealmSchema),
    tagUnitIds: t.Optional(t.Array(t.String())),
    realmTagUnitIds: t.Optional(t.Array(t.String())),
    subjects: t.Optional(zoneSectionQuerySubjectsSchema),
    targetUnitId: t.Optional(t.String()),
    languages: t.Optional(zoneSectionQueryLanguagesSchema),
    ratings: t.Optional(t.Array(contentRatingSchema)),
    sort: zoneSectionQuerySortSchema,
  },
  { additionalProperties: false },
);

export type ZoneSectionQuery = Static<typeof zoneSectionQuerySchema>;

// ANCHOR: Zone section primitives
// ANCHOR: 专区分区原语

export const zoneSectionEmptyStateSchema = t.Union([
  t.Literal("hide"),
  t.Literal("show-empty"),
]);

export type ZoneSectionEmptyState = Static<typeof zoneSectionEmptyStateSchema>;

export const zoneSectionDisplaySchema = t.Union([
  t.Literal("tiles"),
  t.Literal("grid"),
  t.Literal("list"),
  t.Literal("carousel"),
  t.Literal("covers"),
  t.Literal("featured"),
]);

export type ZoneSectionDisplay = Static<typeof zoneSectionDisplaySchema>;

/**
 * Section title resolution chain: `titleLabelUnitId` (LABEL unit) →
 * kind-default frontend i18n key. There is no inline title text.
 * 分区标题解析链：`titleLabelUnitId`（LABEL Unit）→ 按 kind 的默认前端
 * i18n key。不存在内联标题文本。
 */
const zoneSectionBaseSchema = t.Object(
  {
    id: t.String(),
    titleLabelUnitId: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    emptyState: t.Optional(zoneSectionEmptyStateSchema),
  },
  { additionalProperties: false },
);

export const zoneCollectionItemSchema = t.Object(
  {
    target: zoneLinkTargetSchema,
    labelUnitId: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type ZoneCollectionItem = Static<typeof zoneCollectionItemSchema>;

/**
 * `hero` owns no text: it renders the zone unit's own `UnitTranslation`
 * title/description; there is no separate hero title storage.
 * `hero` 不拥有文本：它渲染专区 Unit 自身的 `UnitTranslation`
 * 标题/描述；不存在单独的 hero 标题存储。
 */
export const zoneHeroSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("hero"),
    showDescription: t.Optional(t.Boolean()),
    bannerImageUnitId: t.Optional(t.String()),
    logoImageUnitId: t.Optional(t.String()),
    ctas: t.Optional(t.Array(zoneCollectionItemSchema)),
  },
  { additionalProperties: false },
);

export type ZoneHeroSection = Static<typeof zoneHeroSectionSchema>;

/**
 * `contentUnitId` references a "zone fragment": a POST unit with
 * `kind: "WIKI"` and `visibility: "UNLISTED"`, edited through the standard
 * wiki editor + `ContentTranslation` workflow. UNLISTED keeps fragments out
 * of wiki listings, query sections, and search while still rendering here.
 * `contentUnitId` 引用一个“专区片段”：`kind: "WIKI"` 且
 * `visibility: "UNLISTED"` 的 POST Unit，通过标准 wiki 编辑器 +
 * `ContentTranslation` 工作流编辑。UNLISTED 使片段不出现在 wiki 列表、
 * 查询分区与搜索中，但仍在此处渲染。
 */
export const zoneRichTextSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("richText"),
    contentUnitId: t.String(),
  },
  { additionalProperties: false },
);

export type ZoneRichTextSection = Static<typeof zoneRichTextSectionSchema>;

export const zoneCollectionSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("collection"),
    items: t.Array(zoneCollectionItemSchema),
    display: zoneSectionDisplaySchema,
  },
  { additionalProperties: false },
);

export type ZoneCollectionSection = Static<typeof zoneCollectionSectionSchema>;

export const zoneQuerySectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("query"),
    query: zoneSectionQuerySchema,
    display: zoneSectionDisplaySchema,
    loadMore: t.Optional(t.Boolean()),
  },
  { additionalProperties: false },
);

export type ZoneQuerySection = Static<typeof zoneQuerySectionSchema>;

export const zoneFeedSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("feed"),
    feedKind: t.Optional(
      t.Union([t.Literal("all"), t.Literal("updates"), t.Literal("reviews")]),
    ),
  },
  { additionalProperties: false },
);

export type ZoneFeedSection = Static<typeof zoneFeedSectionSchema>;

export const zoneStatsMetricSchema = t.Union([
  t.Literal("articles"),
  t.Literal("members"),
]);

export type ZoneStatsMetric = Static<typeof zoneStatsMetricSchema>;

export const zoneStatsSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("stats"),
    metrics: t.Array(zoneStatsMetricSchema),
  },
  { additionalProperties: false },
);

export type ZoneStatsSection = Static<typeof zoneStatsSectionSchema>;

/**
 * The 6 content primitives. Container nesting rules are encoded in the
 * union layering below: `tabs` panes hold content sections only; `columns`
 * panes hold content sections or `tabs`; `columns` itself appears only at
 * page top level. No tabs-in-tabs, no columns-in-anything.
 * 6 个内容原语。容器嵌套规则编码在下方的联合分层中：`tabs` 面板只容纳
 * 内容分区；`columns` 面板容纳内容分区或 `tabs`；`columns` 自身只出现
 * 在页面顶层。不允许 tabs 套 tabs，不允许任何东西套 columns。
 */
export const zoneContentSectionSchema = t.Union([
  zoneHeroSectionSchema,
  zoneRichTextSectionSchema,
  zoneCollectionSectionSchema,
  zoneQuerySectionSchema,
  zoneFeedSectionSchema,
  zoneStatsSectionSchema,
]);

export type ZoneContentSection = Static<typeof zoneContentSectionSchema>;

export const zoneTabsSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("tabs"),
    defaultTabId: t.Optional(t.String()),
    tabs: t.Array(
      t.Object(
        {
          id: t.String(),
          titleLabelUnitId: t.Optional(t.String()),
          sections: t.Array(zoneContentSectionSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type ZoneTabsSection = Static<typeof zoneTabsSectionSchema>;

export const zoneColumnsSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("columns"),
    sidePosition: t.Optional(t.Union([t.Literal("left"), t.Literal("right")])),
    side: t.Array(t.Union([zoneContentSectionSchema, zoneTabsSectionSchema])),
    main: t.Array(t.Union([zoneContentSectionSchema, zoneTabsSectionSchema])),
  },
  { additionalProperties: false },
);

export type ZoneColumnsSection = Static<typeof zoneColumnsSectionSchema>;

export const zonePageSectionSchema = t.Union([
  zoneContentSectionSchema,
  zoneTabsSectionSchema,
  zoneColumnsSectionSchema,
]);

export type ZonePageSection = Static<typeof zonePageSectionSchema>;

export type ZoneSection = ZonePageSection;

export type ZoneSectionKind = ZonePageSection["kind"];
