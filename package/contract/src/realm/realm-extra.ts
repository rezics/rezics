import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import { mediaUrlSchema } from "../media-url";

export const realmRuleExtraNote =
  "Single Post Unit ID that holds the realm's rule content shown before joining.";
export const realmAboutExtraNote =
  "Single Post Unit ID that holds the realm's about or sidebar content.";
export const realmBannerExtraNote =
  "Direct image URL used as the realm's banner.";
export const realmAvatarExtraNote =
  "Direct image URL used as the realm's avatar.";
export const realmTagTreeExtraNote =
  "Ordered tag picker tree used as a realm posting UX hint; it does not constrain tagging.";
export const realmFeaturedZoneExtraNote =
  "Optional weak link to a Zone Unit featured in the realm sidebar; unresolved links render nothing.";
export const realmWikiSidebarExtraNote =
  "Optional single source for the realm Wiki sidebar; absent uses the automatic wiki page list.";

export const realmTagViewStyleValues = ["flat", "grouped", "tree"] as const;

export const realmTagViewStyleSchema = t.Union([
  t.Literal("flat"),
  t.Literal("grouped"),
  t.Literal("tree"),
]);

export type RealmTagViewStyle = (typeof realmTagViewStyleSchema)["static"];

export const realmTagViewSchema = t.Object(
  {
    defaultStyle: realmTagViewStyleSchema,
    allowViewerSwitch: t.Boolean(),
  },
  { additionalProperties: false },
);

export type RealmTagView = (typeof realmTagViewSchema)["static"];

export const realmWikiSidebarSchema = t.Union([
  t.Object(
    {
      kind: t.Literal("post"),
      postUnitId: t.String(),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("zoneNav"),
      zoneUnitId: t.String(),
      menuId: t.Optional(t.String()),
    },
    { additionalProperties: false },
  ),
]);

export type RealmWikiSidebar = (typeof realmWikiSidebarSchema)["static"];

export const realmTagTreeLabelSchema = t.Object(
  {
    translations: t.Record(t.String(), t.String()),
    fallbackLanguage: t.Optional(contentLanguageSchema),
  },
  { additionalProperties: false },
);

export type RealmTagTreeLabel = (typeof realmTagTreeLabelSchema)["static"];

// ============================================================
// REALM EXTRA — typed shape of `Realm.extra`
// REALM EXTRA — `Realm.extra` 的类型化结构
// ============================================================

export const realmImageExtraSchema = t.Object(
  {
    kind: t.Literal("url"),
    url: mediaUrlSchema,
  },
  { additionalProperties: false },
);

export type RealmImageExtra = (typeof realmImageExtraSchema)["static"];

export const realmBannerExtraSchema = realmImageExtraSchema;

export type RealmBannerExtra = (typeof realmBannerExtraSchema)["static"];

export const realmAvatarExtraSchema = realmImageExtraSchema;

export type RealmAvatarExtra = (typeof realmAvatarExtraSchema)["static"];

export const tagTreeNodeSchema: ReturnType<typeof t.Recursive> = t.Recursive(
  (self) =>
    t.Object(
      {
        tagId: t.Optional(t.String()),
        label: t.Optional(t.String()),
        labelUnitId: t.Optional(t.String()),
        labelTranslations: t.Optional(realmTagTreeLabelSchema),
        children: t.Optional(t.Array(self)),
      },
      { additionalProperties: false },
    ),
);

export type TagTreeNode = {
  tagId?: string;
  label?: string;
  labelUnitId?: string;
  labelTranslations?: RealmTagTreeLabel;
  children?: TagTreeNode[];
};

/**
 * Typed shape of `Realm.extra`. Two well-known keys carry curated ordered Unit
 * ID lists for realm-level surfaces:
 *
 * `Realm.extra` 的类型化结构。两个约定键承载用于 realm 级展示的有序 Unit ID 列表：
 *
 * - `pinboard` — an ordered list of Unit IDs pinned within the realm. Surfaced
 *   on the realm page above the feed; entries are usually POST Releases of
 *   Work entries authored by the realm's contributors.
 *   在 realm 内置顶的 Unit ID 有序列表。展示在 realm 页面 feed 上方；条目通常是
 *   realm 贡献者发布的 Work 条目的 POST Release。
 * - `announcement` — an ordered list of Unit IDs reserved for special pages
 *   like the homepage announcement bar. **Not for general forum
 *   notifications** — use the realm's normal posting flow for those.
 *   预留给首页公告栏等特殊页面的 Unit ID 有序列表。**不用于一般论坛通知** —
 *   那些应使用 realm 的常规发帖流程。
 *
 * Additional unspecified keys may coexist on `Realm.extra` (the trust
 * strategy applies — clients may store arbitrary JSON-serializable values
 * under any other key without contract enforcement).
 *
 * `Realm.extra` 上可同时存在其他未指定的键（适用信任策略 — 客户端可在任意其他键下
 * 存储任意可 JSON 序列化的值，不受 contract 强制约束）。
 */
export const realmExtraSchema = t.Object(
  {
    /**
     * Ordered list of Unit IDs pinned within the realm. Surfaced on the realm
     * page above the feed; entries are usually POST Releases of Work entries
     * authored by the realm's contributors.
     * 在 realm 内置顶的 Unit ID 有序列表。展示在 realm 页面 feed 上方；条目通常是
     * realm 贡献者发布的 Work 条目的 POST Release。
     */
    pinboard: t.Optional(t.Array(t.String())),

    /**
     * Ordered list of Unit IDs reserved for special pages like the homepage
     * announcement bar. Not for general forum notifications; reserved for
     * special pages like the homepage announcement bar.
     * 预留给首页公告栏等特殊页面的 Unit ID 有序列表。不用于一般论坛通知；仅预留给
     * 首页公告栏等特殊页面。
     */
    announcement: t.Optional(t.Array(t.String())),

    /**
     * Single Post Unit ID that holds the realm's rule content shown before
     * joining.
     * 承载 realm 规则内容（加入前展示）的单个 Post Unit ID。
     */
    rule: t.Optional(t.String()),

    /**
     * Single Post Unit ID that holds the realm's about or sidebar content.
     * 承载 realm 简介或侧边栏内容的单个 Post Unit ID。
     */
    about: t.Optional(t.String()),

    /**
     * Direct image URL used as the realm's banner.
     * 用作 realm 横幅的直接图片 URL。
     */
    banner: t.Optional(realmBannerExtraSchema),

    /**
     * Direct image URL used as the realm's avatar.
     * 用作 realm 头像的直接图片 URL。
     */
    avatar: t.Optional(realmAvatarExtraSchema),

    /**
     * Ordered tag picker tree used as a realm posting UX hint; it does not
     * constrain tagging.
     * 用作 realm 发帖 UX 提示的有序标签选择树；它不约束实际打标签。
     */
    tagTree: t.Optional(t.Array(tagTreeNodeSchema)),

    /**
     * Preferred realm Tags tab navigation style. New realms default to flat
     * when this preference is absent.
     * realm Tags 标签页的首选导航样式。此偏好缺失时新 realm 默认为 flat。
     */
    tagView: t.Optional(realmTagViewSchema),

    /**
     * Advisory default Unit publication license for composer prefill in this
     * realm. Created Units store their selected license explicitly.
     * 用于本 realm 编辑器预填的建议性默认 Unit 发布许可。已创建的 Unit 显式存储
     * 各自选定的许可。
     */
    defaultLicenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),

    /**
     * Optional weak link to a Zone Unit surfaced as a featured card in the
     * realm sidebar. This is intentionally not a structural ownership edge:
     * the server only stores the id, the frontend resolves it and renders
     * nothing when the target is missing.
     * 在 realm 侧栏展示的可选 Zone Unit 弱链接。它刻意不是结构性归属边：
     * 服务端只保存 id，前端解析失败时不渲染。
     */
    featuredZoneUnitId: t.Optional(t.Nullable(t.String())),

    /**
     * Optional single source for the realm Wiki sidebar. Absent means the
     * automatic realm wiki page list; `post` embeds one sidebar post; `zoneNav`
     * renders an app-themed Zone navigation tree. All references are weak links.
     * realm Wiki 侧栏的可选单一来源。缺失时使用自动 realm wiki 页面列表；
     * `post` 嵌入一个侧栏帖子；`zoneNav` 渲染应用主题的 Zone 导览树。
     * 所有引用都是弱链接。
     */
    wikiSidebar: t.Optional(realmWikiSidebarSchema),
  },
  { additionalProperties: true },
);

export type RealmExtra = (typeof realmExtraSchema)["static"];

/**
 * Whitelist of well-known Realm.extra list keys recognised by the typed
 * primitives. Other keys are accepted at runtime but are not type-checked
 * via `RealmExtra`.
 * 类型化原语识别的约定 Realm.extra 列表键白名单。其他键在运行时被接受，但不会
 * 通过 `RealmExtra` 进行类型检查。
 */
export const REALM_EXTRA_LIST_KEYS = ["pinboard", "announcement"] as const;

export type RealmExtraListKey = (typeof REALM_EXTRA_LIST_KEYS)[number];

export const realmExtraListKeySchema = t.Union([
  t.Literal("pinboard"),
  t.Literal("announcement"),
]);

// ============================================================
// PATH PARAMS
// PATH PARAMS — 路径参数
// ============================================================

export const realmExtraListPathParamsSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
});

export type RealmExtraListPathParams =
  (typeof realmExtraListPathParamsSchema)["static"];

export const realmExtraEntryPathParamsSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitId: t.String(),
});

export type RealmExtraEntryPathParams =
  (typeof realmExtraEntryPathParamsSchema)["static"];

// ============================================================
// REQUEST BODIES
// REQUEST BODIES — 请求体
// ============================================================

export const realmExtraAppendBodySchema = t.Object({
  unitId: t.String(),
});

export type RealmExtraAppendBody =
  (typeof realmExtraAppendBodySchema)["static"];

export const realmExtraReorderBodySchema = t.Object({
  unitIds: t.Array(t.String()),
});

export type RealmExtraReorderBody =
  (typeof realmExtraReorderBodySchema)["static"];

// ============================================================
// READ RESPONSES
// READ RESPONSES — 读取响应
// ============================================================

/**
 * Public read shape: stale IDs are filtered out before the array is returned.
 * `unitIds` reflects only currently-visible Units.
 * 公开读取结构：返回数组前会过滤掉失效 ID。`unitIds` 仅反映当前可见的 Unit。
 */
export const realmExtraReadResponseSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitIds: t.Array(t.String()),
});

export type RealmExtraReadResponse =
  (typeof realmExtraReadResponseSchema)["static"];

/**
 * Admin read shape: returns the full stored array plus a parallel `staleIds`
 * list flagging entries the caller's view would otherwise drop. Surfaces
 * deleted/missing units so moderators can clean up entries.
 * 管理读取结构：返回完整的存储数组，外加一个并行的 `staleIds` 列表，标记调用方
 * 视图本会丢弃的条目。暴露已删除/缺失的 unit，便于管理员清理条目。
 */
export const realmExtraAdminReadResponseSchema = t.Object({
  realmId: t.String(),
  key: t.String(),
  unitIds: t.Array(t.String()),
  staleIds: t.Array(t.String()),
});

export type RealmExtraAdminReadResponse =
  (typeof realmExtraAdminReadResponseSchema)["static"];

export const realmExtraOkResponseSchema = t.Object({
  ok: t.Literal(true),
  unitIds: t.Optional(t.Array(t.String())),
});

export type RealmExtraOkResponse =
  (typeof realmExtraOkResponseSchema)["static"];
