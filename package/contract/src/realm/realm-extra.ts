import { t } from "elysia";
import { licenseSlugSchema } from "../license";
import { mediaUrlSchema } from "../media-url";

export const realmBannerExtraNote =
  "Direct image URL used as the realm's banner.";
export const realmAvatarExtraNote =
  "Direct image URL used as the realm's avatar.";

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

/**
 * `Realm.extra` only keeps profile chrome and low-level realm preferences that
 * have not yet been promoted to explicit columns. Composed display surfaces
 * live in `Realm.dock`, ordered promoted content lives in Pinboard tables,
 * ordered promoted content lives in Pinboard tables, realm tag taxonomy lives
 * in RealmTagTree, and rule governance lives in RealmRulePolicy.
 *
 * `Realm.extra` 只保留尚未提升为显式栏位的资料外观与底层偏好。组合展示界面
 * 属于 `Realm.dock`，有序推广内容属于 Pinboard 表，realm 标签树属于
 * RealmTagTree，规则治理属于 RealmRulePolicy。
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
