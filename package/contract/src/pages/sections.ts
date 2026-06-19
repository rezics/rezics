import type { Static } from "elysia";
import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { postKindLiterals } from "../post/post";
import {
  literalSchemaFromValues,
  schemaNodeIdSchema,
  schemaSlugSchema,
} from "../schema";
import { contentRatingSchema, unitTypeSchema } from "../unit/unit";
import { zoneLinkTargetSchema } from "../zone/link-target";

// ANCHOR: Page section query
// ANCHOR: 页面分区查询

/**
 * `PageSectionQuery` compiles only to fields the Meilisearch `content`,
 * `posts`, `realms`, or `zones` indexes can filter or sort; the server-side compiler rejects
 * combinations outside that vocabulary (e.g. `tagUnitIds` on the posts
 * index). Semantic section variants ("latest", "popular", "recent wiki")
 * are query presets plus default-title i18n keys, never new section kinds.
 * `PageSectionQuery` 只编译为 Meilisearch `content`、`posts`、`realms` 或 `zones` 索引可
 * 过滤或排序的字段；服务端编译器会拒绝词汇表之外的组合（例如 posts
 * 索引上的 `tagUnitIds`）。语义化的分区变体（“最新”“热门”“最近 wiki”）
 * 是查询预设加默认标题 i18n key，绝不是新的分区 kind。
 */
export const pageSectionQueryRealmSchema = t.Union([
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

export type PageSectionQueryRealm = Static<typeof pageSectionQueryRealmSchema>;

/**
 * "viewer" resolves to the reader's language candidate chain at execution
 * time.
 * "viewer" 在执行时解析为读者的语言候选链。
 */
export const pageSectionQueryLanguagesSchema = t.Union([
  t.Literal("viewer"),
  t.Array(contentLanguageSchema),
]);

export type PageSectionQueryLanguages = Static<
  typeof pageSectionQueryLanguagesSchema
>;

export const pageSectionQuerySortFieldSchema = t.Union([
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

export type PageSectionQuerySortField = Static<
  typeof pageSectionQuerySortFieldSchema
>;

export const pageSectionQuerySortSchema = t.Object(
  {
    field: pageSectionQuerySortFieldSchema,
    direction: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  },
  { additionalProperties: false },
);

export type PageSectionQuerySort = Static<typeof pageSectionQuerySortSchema>;

export const pageSectionQuerySubjectsSchema = t.Object(
  {
    entityUnitIds: t.Optional(t.Array(t.String())),
    roles: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export type PageSectionQuerySubjects = Static<
  typeof pageSectionQuerySubjectsSchema
>;

export const pageSectionQuerySchema = t.Object(
  {
    target: t.Union([
      t.Literal("unit"),
      t.Literal("post"),
      t.Literal("realm"),
      t.Literal("zone"),
    ]),
    types: t.Optional(t.Array(unitTypeSchema)),
    postKinds: t.Optional(t.Array(postKindLiterals)),
    realm: t.Optional(pageSectionQueryRealmSchema),
    tagUnitIds: t.Optional(t.Array(t.String())),
    realmTagUnitIds: t.Optional(t.Array(t.String())),
    subjects: t.Optional(pageSectionQuerySubjectsSchema),
    targetUnitId: t.Optional(t.String()),
    languages: t.Optional(pageSectionQueryLanguagesSchema),
    ratings: t.Optional(t.Array(contentRatingSchema)),
    sort: pageSectionQuerySortSchema,
  },
  { additionalProperties: false },
);

export type PageSectionQuery = Static<typeof pageSectionQuerySchema>;
export type PageSectionQueryTarget = PageSectionQuery["target"];
export type PageSectionQueryFilterField = keyof Omit<
  PageSectionQuery,
  "target" | "sort"
>;

/**
 * Per-target Meilisearch field vocabulary for page query sections. The
 * contract owns this table because server compilation and app-side management
 * editors must stay in lockstep when a query target is added.
 * 专区查询分区按目标划分的 Meilisearch 字段词汇表。契约拥有此表，因为
 * 服务端编译与应用端管理编辑器在新增查询目标时必须保持同步。
 */
export const PAGE_SECTION_QUERY_FILTERABLE_FIELDS = {
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
  PageSectionQueryTarget,
  readonly PageSectionQueryFilterField[]
>;

export const PAGE_SECTION_QUERY_SORT_FIELDS = {
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
  PageSectionQueryTarget,
  readonly PageSectionQuerySortField[]
>;

// ANCHOR: Page section primitives
// ANCHOR: 页面分区原语

export const pageDynamicTagOptionSchema = t.Object(
  {
    tagUnitIds: t.Array(t.String(), { minItems: 1 }),
    probability: t.Number({ minimum: 0, maximum: 1 }),
  },
  { additionalProperties: false },
);

export type PageDynamicTagOption = Static<typeof pageDynamicTagOptionSchema>;

/**
 * Dynamic tags are a query-section modifier, not a section kind. Random
 * selection is frontend-owned; saved config only stores canonical tag unit ids
 * and probabilities.
 * 动态标签是 query 分区的修饰项，而不是新的分区类型。随机选择由前端负责；
 * 持久化配置只保存规范化后的 tag unit id 与概率。
 */
export const pageDynamicTagsSchema = t.Object(
  {
    groupId: t.Optional(t.String()),
    fallback: t.Optional(t.Boolean()),
    options: t.Array(pageDynamicTagOptionSchema),
  },
  { additionalProperties: false },
);

export type PageDynamicTags = Static<typeof pageDynamicTagsSchema>;

export const pageSectionEmptyStateSchema = t.Union([
  t.Literal("hide"),
  t.Literal("show-empty"),
]);

export type PageSectionEmptyState = Static<typeof pageSectionEmptyStateSchema>;

export const pageSectionDisplaySchema = t.Union([
  t.Literal("tiles"),
  t.Literal("grid"),
  t.Literal("list"),
  t.Literal("stream"),
  t.Literal("carousel"),
  t.Literal("covers"),
  t.Literal("featured"),
  t.Literal("avatar-wall"),
]);

export type PageSectionDisplay = Static<typeof pageSectionDisplaySchema>;

const httpsUrlSchema = t.String({ pattern: "^https://" });

export const pageSectionKindValues = [
  "stage",
  "zoneInfo",
  "image",
  "actions",
  "richText",
  "collection",
  "query",
  "stream",
  "stats",
  "sources",
  "tabs",
  "columns",
] as const;

export const pageSectionKindSchema = literalSchemaFromValues(
  pageSectionKindValues,
);

export type PageSectionKind = (typeof pageSectionKindValues)[number];

/**
 * Section title resolution chain: `titleLabelUnitId` (LABEL unit) →
 * kind-default frontend i18n key. There is no inline title text.
 * 分区标题解析链：`titleLabelUnitId`（LABEL Unit）→ 按 kind 的默认前端
 * i18n key。不存在内联标题文本。
 */
const pageSectionBaseSchema = t.Object(
  {
    nodeId: schemaNodeIdSchema,
    slug: t.Optional(schemaSlugSchema),
    titleLabelUnitId: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    emptyState: t.Optional(pageSectionEmptyStateSchema),
  },
  { additionalProperties: false },
);

export const pageCollectionItemSchema = t.Object(
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

export type PageCollectionItem = Static<typeof pageCollectionItemSchema>;

/**
 * `zoneInfo` is stage-only profile chrome: it makes zone title/description
 * rendering explicit instead of letting a container implicitly read profile
 * fields. Authoring UIs may insert one by default when adding a stage, but the
 * contract does not require it.
 * `zoneInfo` 是仅供 stage 使用的资料组件：它显式声明专区标题/描述的渲染，
 * 而不是让容器隐式读取 profile 字段。编辑器可以在新增 stage 时默认插入
 * 一个，但契约不强制要求。
 */
export const pageZoneInfoSectionSchema = t.Object(
  {
    nodeId: schemaNodeIdSchema,
    kind: t.Literal("zoneInfo"),
    showTitle: t.Optional(t.Boolean()),
    showDescription: t.Optional(t.Boolean()),
  },
  { additionalProperties: false },
);

export type PageZoneInfoSection = Static<typeof pageZoneInfoSectionSchema>;

export const pageImageVariantSchema = t.Union([
  t.Literal("inline"),
  t.Literal("banner"),
  t.Literal("logo"),
]);

export type PageImageVariant = Static<typeof pageImageVariantSchema>;

/**
 * Images are first-class ordered sections, not hidden banner/logo fields on a
 * stage. A target makes the image interactive; without a target it is purely
 * presentational.
 * 图片是一等可排序分区，不再是 stage 上隐藏的横幅/标识字段。带 target
 * 时图片可交互；没有 target 时只做展示。
 */
export const pageImageSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("image"),
    url: httpsUrlSchema,
    variant: t.Optional(pageImageVariantSchema),
    altLabelUnitId: t.Optional(t.String()),
    target: t.Optional(zoneLinkTargetSchema),
  },
  { additionalProperties: false },
);

export type PageImageSection = Static<typeof pageImageSectionSchema>;

export const pageActionBuiltInSchema = t.Union([
  t.Literal("joinRealm"),
  t.Literal("createWiki"),
  t.Literal("createPost"),
]);

export type PageActionBuiltIn = Static<typeof pageActionBuiltInSchema>;

export const pageActionsSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("actions"),
    items: t.Optional(t.Array(pageCollectionItemSchema)),
    builtIns: t.Optional(t.Array(pageActionBuiltInSchema)),
  },
  { additionalProperties: false },
);

export type PageActionsSection = Static<typeof pageActionsSectionSchema>;

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
export const pageRichTextSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("richText"),
    contentUnitId: t.String(),
  },
  { additionalProperties: false },
);

export type PageRichTextSection = Static<typeof pageRichTextSectionSchema>;

export const pageCollectionSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("collection"),
    items: t.Array(pageCollectionItemSchema),
    display: pageSectionDisplaySchema,
  },
  { additionalProperties: false },
);

export type PageCollectionSection = Static<typeof pageCollectionSectionSchema>;

export const pageQuerySectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("query"),
    query: pageSectionQuerySchema,
    display: pageSectionDisplaySchema,
    loadMore: t.Optional(t.Boolean()),
    dynamicTags: t.Optional(pageDynamicTagsSchema),
  },
  { additionalProperties: false },
);

export type PageQuerySection = Static<typeof pageQuerySectionSchema>;

export const pageStreamSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("stream"),
    streamKind: t.Optional(
      t.Union([t.Literal("all"), t.Literal("updates"), t.Literal("reviews")]),
    ),
  },
  { additionalProperties: false },
);

export type PageStreamSection = Static<typeof pageStreamSectionSchema>;

export const pageStatsMetricSchema = t.Union([
  t.Literal("articles"),
  t.Literal("members"),
]);

export type PageStatsMetric = Static<typeof pageStatsMetricSchema>;

export const pageStatsSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("stats"),
    metrics: t.Array(pageStatsMetricSchema),
  },
  { additionalProperties: false },
);

export type PageStatsSection = Static<typeof pageStatsSectionSchema>;

/**
 * `sources` renders external presences attached to the zone Unit itself:
 * a ZONE is a Unit, so its `UnitExternalLink`s mean "this portal's
 * counterparts elsewhere". There is intentionally no section `unitId`;
 * readers always query the owning zone unit.
 * `sources` 渲染挂在专区 Unit 自身上的外部存在：ZONE 本身就是 Unit，
 * 其 `UnitExternalLink` 表示“这个门户在其他地方的对应站点”。这里刻意
 * 没有分区级 `unitId`；读取方始终查询所属专区 Unit。
 */
export const pageSourcesSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("sources"),
  },
  { additionalProperties: false },
);

export type PageSourcesSection = Static<typeof pageSourcesSectionSchema>;

/**
 * Content primitives own their own rendered content and data needs. Container
 * nesting rules are encoded in the union layering below: `tabs` panes hold
 * content sections only; `columns` panes hold content sections or `tabs`;
 * `stage` panes hold content sections, `tabs`, or `columns`, but never another
 * `stage`.
 * 内容原语拥有自身渲染内容与数据需求。容器嵌套规则编码在下方的联合分层
 * 中：`tabs` 面板只容纳内容分区；`columns` 面板容纳内容分区或 `tabs`；
 * `stage` 面板容纳内容分区、`tabs` 或 `columns`，但不能再套 `stage`。
 */
export const pageContentSectionSchema = t.Union([
  pageImageSectionSchema,
  pageActionsSectionSchema,
  pageRichTextSectionSchema,
  pageCollectionSectionSchema,
  pageQuerySectionSchema,
  pageStreamSectionSchema,
  pageStatsSectionSchema,
  pageSourcesSectionSchema,
]);

export type PageContentSection = Static<typeof pageContentSectionSchema>;

export const pageTabsSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("tabs"),
    defaultTabNodeId: t.Optional(schemaNodeIdSchema),
    tabs: t.Array(
      t.Object(
        {
          nodeId: schemaNodeIdSchema,
          slug: t.Optional(schemaSlugSchema),
          titleLabelUnitId: t.Optional(t.String()),
          sections: t.Array(pageContentSectionSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type PageTabsSection = Static<typeof pageTabsSectionSchema>;

export const pageColumnSchema = t.Object(
  {
    ratio: t.Integer({ minimum: 1, maximum: 12 }),
    sections: t.Array(
      t.Union([pageContentSectionSchema, pageTabsSectionSchema]),
    ),
  },
  { additionalProperties: false },
);

export type PageColumn = Static<typeof pageColumnSchema>;

export const pageColumnsSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("columns"),
    columns: t.Array(pageColumnSchema, { minItems: 2, maxItems: 4 }),
  },
  { additionalProperties: false },
);

export type PageColumnsSection = Static<typeof pageColumnsSectionSchema>;

export const pageStageBackgroundSchema = t.Object(
  {
    color: t.Optional(t.String()),
    imageUrl: t.Optional(httpsUrlSchema),
    fit: t.Optional(t.Union([t.Literal("cover"), t.Literal("contain")])),
    position: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type PageStageBackground = Static<typeof pageStageBackgroundSchema>;

export const pageStageMaskSchema = t.Object(
  {
    color: t.Optional(t.String()),
    opacity: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  },
  { additionalProperties: false },
);

export type PageStageMask = Static<typeof pageStageMaskSchema>;

export const pageStageChildSectionSchema = t.Union([
  pageZoneInfoSectionSchema,
  pageContentSectionSchema,
  pageTabsSectionSchema,
  pageColumnsSectionSchema,
]);

export type PageStageChildSection = Static<typeof pageStageChildSectionSchema>;

/**
 * A stage is decorated page chrome: background, mask, and an ordered child
 * section list. It owns no layout vocabulary of its own; use existing
 * `columns`/`tabs` child sections for composition. Stages cannot nest.
 * stage 是带装饰的页面容器：背景、蒙板与有序子分区列表。它不拥有独立布局
 * 词汇；组合仍使用已有的 `columns`/`tabs` 子分区。stage 不能嵌套。
 */
export const pageStageSectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("stage"),
    background: t.Optional(pageStageBackgroundSchema),
    mask: t.Optional(pageStageMaskSchema),
    sections: t.Array(pageStageChildSectionSchema),
  },
  { additionalProperties: false },
);

export type PageStageSection = Static<typeof pageStageSectionSchema>;

export const pageSectionSchema = t.Union([
  pageStageSectionSchema,
  pageContentSectionSchema,
  pageTabsSectionSchema,
  pageColumnsSectionSchema,
]);

export type PageSection = Static<typeof pageSectionSchema>;
