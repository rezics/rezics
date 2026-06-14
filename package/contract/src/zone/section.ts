import type { Static } from "elysia";
import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { postKindLiterals } from "../post/post";
import { contentRatingSchema, unitTypeSchema } from "../unit/unit";
import { zoneLinkTargetSchema } from "./link-target";

// ANCHOR: Zone section query
// ANCHOR: 专区分区查询

/**
 * `ZoneSectionQuery` compiles only to fields the Meilisearch `content`,
 * `posts`, `realms`, or `zones` indexes can filter or sort; the server-side compiler rejects
 * combinations outside that vocabulary (e.g. `tagUnitIds` on the posts
 * index). Semantic section variants ("latest", "popular", "recent wiki")
 * are query presets plus default-title i18n keys, never new section kinds.
 * `ZoneSectionQuery` 只编译为 Meilisearch `content`、`posts`、`realms` 或 `zones` 索引可
 * 过滤或排序的字段；服务端编译器会拒绝词汇表之外的组合（例如 posts
 * 索引上的 `tagUnitIds`）。语义化的分区变体（“最新”“热门”“最近 wiki”）
 * 是查询预设加默认标题 i18n key，绝不是新的分区 kind。
 */
export const zoneSectionQueryRealmSchema = t.Union([
  // "context" resolves to `boundary.context` at execution time.
  // "context" 在执行时解析为 `boundary.context`。
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
  t.Array(contentLanguageSchema),
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
  t.Literal("memberCount"),
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
    target: t.Union([
      t.Literal("unit"),
      t.Literal("post"),
      t.Literal("realm"),
      t.Literal("zone"),
    ]),
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
export type ZoneSectionQueryTarget = ZoneSectionQuery["target"];
export type ZoneSectionQueryFilterField = keyof Omit<
  ZoneSectionQuery,
  "target" | "sort"
>;

/**
 * Per-target Meilisearch field vocabulary for zone query sections. The
 * contract owns this table because server compilation and app-side management
 * editors must stay in lockstep when a query target is added.
 * 专区查询分区按目标划分的 Meilisearch 字段词汇表。契约拥有此表，因为
 * 服务端编译与应用端管理编辑器在新增查询目标时必须保持同步。
 */
export const ZONE_SECTION_QUERY_FILTERABLE_FIELDS = {
  unit: [
    "types",
    "postKinds",
    "realm",
    "tagUnitIds",
    "realmTagUnitIds",
    "subjects",
    "targetUnitId",
    "languages",
    "ratings",
  ],
  post: ["postKinds", "realm", "targetUnitId", "languages"],
  realm: ["types", "languages"],
  zone: ["types", "realm", "languages"],
} as const satisfies Record<
  ZoneSectionQueryTarget,
  readonly ZoneSectionQueryFilterField[]
>;

export const ZONE_SECTION_QUERY_SORT_FIELDS = {
  unit: [
    "createdAt",
    "updatedAt",
    "publishedAt",
    "bestScore",
    "hotScore",
    "topScore",
    "risingScore",
    "controversyScore",
    "trendingScore",
    "qualityScore",
  ],
  post: [
    "createdAt",
    "updatedAt",
    "replyCount",
    "bestScore",
    "hotScore",
    "topScore",
    "risingScore",
    "controversyScore",
    "trendingScore",
    "qualityScore",
  ],
  realm: ["createdAt", "updatedAt", "memberCount"],
  zone: ["createdAt", "updatedAt"],
} as const satisfies Record<
  ZoneSectionQueryTarget,
  readonly ZoneSectionQuerySortField[]
>;

// ANCHOR: Zone section primitives
// ANCHOR: 专区分区原语

export const zoneDynamicTagOptionSchema = t.Object(
  {
    tagUnitIds: t.Array(t.String(), { minItems: 1 }),
    probability: t.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);

export type ZoneDynamicTagOption = Static<typeof zoneDynamicTagOptionSchema>;

/**
 * Dynamic tags are a query-section modifier, not a section kind. Random
 * selection is frontend-owned; saved config only stores canonical tag unit ids
 * and probabilities.
 * 动态标签是 query 分区的修饰项，而不是新的分区类型。随机选择由前端负责；
 * 持久化配置只保存规范化后的 tag unit id 与概率。
 */
export const zoneDynamicTagsSchema = t.Object(
  {
    groupId: t.Optional(t.String()),
    fallback: t.Optional(t.Boolean()),
    options: t.Array(zoneDynamicTagOptionSchema),
  },
  { additionalProperties: false },
);

export type ZoneDynamicTags = Static<typeof zoneDynamicTagsSchema>;

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
  t.Literal("avatar-wall"),
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
    // Optional display unit only affects rendered avatar/title; click behavior
    // still follows `target`, so an item can show an entity while linking to a
    // wiki page or external resource.
    displayUnitId: t.Optional(t.String()),
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
    bannerImageUrl: t.Optional(t.String({ pattern: "^https://" })),
    logoImageUrl: t.Optional(t.String({ pattern: "^https://" })),
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
    dynamicTags: t.Optional(zoneDynamicTagsSchema),
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
 * `sources` renders external presences attached to the zone Unit itself:
 * a ZONE is a Unit, so its `UnitExternalLink`s mean "this portal's
 * counterparts elsewhere". There is intentionally no section `unitId`;
 * readers always query the owning zone unit.
 * `sources` 渲染挂在专区 Unit 自身上的外部存在：ZONE 本身就是 Unit，
 * 其 `UnitExternalLink` 表示“这个门户在其他地方的对应站点”。这里刻意
 * 没有分区级 `unitId`；读取方始终查询所属专区 Unit。
 */
export const zoneSourcesSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("sources"),
  },
  { additionalProperties: false },
);

export type ZoneSourcesSection = Static<typeof zoneSourcesSectionSchema>;

/**
 * The 7 content primitives. Container nesting rules are encoded in the
 * union layering below: `tabs` panes hold content sections only; `columns`
 * panes hold content sections or `tabs`; `columns` itself appears only at
 * page top level. No tabs-in-tabs, no columns-in-anything. This keeps
 * `columns` as an ordered page layout primitive instead of an arbitrary grid
 * builder.
 * 7 个内容原语。容器嵌套规则编码在下方的联合分层中：`tabs` 面板只容纳
 * 内容分区；`columns` 面板容纳内容分区或 `tabs`；`columns` 自身只出现
 * 在页面顶层。不允许 tabs 套 tabs，不允许任何东西套 columns。这使
 * `columns` 保持为有序页面布局原语，而不是任意网格构建器。
 */
export const zoneContentSectionSchema = t.Union([
  zoneHeroSectionSchema,
  zoneRichTextSectionSchema,
  zoneCollectionSectionSchema,
  zoneQuerySectionSchema,
  zoneFeedSectionSchema,
  zoneStatsSectionSchema,
  zoneSourcesSectionSchema,
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

export const zoneColumnSchema = t.Object(
  {
    id: t.String(),
    ratio: t.Integer({ minimum: 1, maximum: 12 }),
    sections: t.Array(
      t.Union([zoneContentSectionSchema, zoneTabsSectionSchema]),
    ),
  },
  { additionalProperties: false },
);

export type ZoneColumn = Static<typeof zoneColumnSchema>;

export const zoneColumnsSectionSchema = t.Object(
  {
    ...zoneSectionBaseSchema.properties,
    kind: t.Literal("columns"),
    columns: t.Array(zoneColumnSchema, { minItems: 2, maxItems: 4 }),
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
