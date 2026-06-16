import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import { mediaUrlSchema } from "../media-url";

export const realmBannerExtraNote =
  "Direct image URL used as the realm's banner.";
export const realmAvatarExtraNote =
  "Direct image URL used as the realm's avatar.";
export const realmTagTreeExtraNote =
  "Ordered tag picker tree used as a realm posting UX hint; it does not constrain tagging.";

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
 * `Realm.extra` only keeps profile chrome and low-level realm preferences that
 * have not yet been promoted to explicit columns. Composed display surfaces
 * live in `Realm.sidebar`, ordered promoted content lives in Pinboard tables,
 * and rule governance lives on `Realm.ruleUnitId`.
 *
 * `Realm.extra` 只保留尚未提升为显式栏位的资料外观与底层偏好。组合展示界面
 * 属于 `Realm.sidebar`，有序推广内容属于 Pinboard 表，规则治理属于
 * `Realm.ruleUnitId`。
 */
export const realmExtraSchema = t.Object(
  {
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
  },
  { additionalProperties: false },
);

export type RealmExtra = (typeof realmExtraSchema)["static"];

export const realmExtraOkResponseSchema = t.Object({
  ok: t.Literal(true),
});

export type RealmExtraOkResponse =
  (typeof realmExtraOkResponseSchema)["static"];
