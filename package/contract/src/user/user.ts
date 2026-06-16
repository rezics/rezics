import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { contentLanguageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { mediaUrlSchema } from "../media-url";
import { paginationLimitSchema } from "../pagination";
import { bookshelfViewConfigSchema } from "../shelf/bookshelf";
import { userSubscriptionListSortSchema } from "../subscription";
import { UnitType, type CatalogUnitType, type ContentRating } from "../unit/unit";

// ============================================================
// USER DTO (UserType removed — no AUTHOR/PRESS/PRODUCER)
// USER DTO（已移除 UserType — 不再有 AUTHOR/PRESS/PRODUCER）
// ============================================================

export const userDTOSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. 用户的规范标识符 — USER 的 `Unit.id`。 */
  unitId: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  name: t.Optional(t.String()),
  avatar: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  description: t.Optional(t.Nullable(contentDocSchema)),
  followersCount: t.Optional(t.Number()),
  followingsCount: t.Optional(t.Number()),
  joinDate: t.Optional(t.String()),
  permission: t.Optional(
    t.Object(
      {
        role: t.Array(t.String()),
      },
      { additionalProperties: true },
    ),
  ),
});

export type UserDTO = (typeof userDTOSchema)["static"];

export const userListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type UserListQuery = (typeof userListQuerySchema)["static"];

export const userListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  q: t.Optional(t.String()),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type UserListBody = (typeof userListBodySchema)["static"];

export const userParamsSchema = t.Object({
  userId: t.String(),
});

export type UserParams = (typeof userParamsSchema)["static"];

export const createUserSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  slug: t.String({
    minLength: 5,
    pattern: "^[a-zA-Z0-9](?:[a-zA-Z0-9-_]*[a-zA-Z0-9])?$",
  }),
  avatar: t.Optional(mediaUrlSchema),
  bio: t.Optional(t.String()),
  verificationCode: t.Optional(t.String()),
});

export type CreateUser = (typeof createUserSchema)["static"];

export const createUserFullSchema = t.Object({
  ...createUserSchema.properties,
});

export type CreateUserFull = (typeof createUserFullSchema)["static"];

export const updateUserSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  avatar: t.Optional(t.Nullable(mediaUrlSchema)),
  bio: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocWriteSchema)),
  password: t.Optional(t.String({ minLength: 6 })),
});

export type UpdateUser = (typeof updateUserSchema)["static"];

export const loginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String(),
});

export type LoginUser = (typeof loginSchema)["static"];

// ============================================================
// USER SETTINGS
// USER SETTINGS — 用户设置
// ============================================================

export const realmTagPreferenceSchema = t.Object({
  realmIds: t.Array(t.String(), { maxItems: 50 }),
  /**
   * Optional display cap for the filtered realm tag list. Missing/null means
   * unlimited; callers truncate after applying any realm filter/order.
   * 过滤后的 realm tag 列表显示上限。缺失/null 表示不限制；调用方先应用 realm
   * 过滤/排序，再截断。
   */
  maxDisplay: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
});

export const contentPreferenceSchema = t.Object({
  /**
   * Age-rating opt-ins. Only R_18 / R_18G are valid values — GENERAL and R_15
   * are always-on baseline and MUST NOT appear here.
   * 年龄分级的主动选择。仅 R_18 / R_18G 为有效值 — GENERAL 和 R_15 是始终开启的
   * 基线，绝不能出现在此处。
   */
  optedInRatings: t.Optional(
    t.Array(t.Union([t.Literal("R_18"), t.Literal("R_18G")])),
  ),
});

export type ContentPreference = (typeof contentPreferenceSchema)["static"];

export const publishingPreferenceSchema = t.Object({
  defaultLicenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
});

export type PublishingPreference =
  (typeof publishingPreferenceSchema)["static"];

export const moderationPreferenceSchema = t.Object({
  /**
   * Account-level default for realm feed management mode. Missing means true;
   * per-realm toggles are session-only UI state.
   * realm feed 管理模式的账户级默认值。缺失即视为 true；按 realm 的开关仅为会话
   * 级的 UI 状态。
   */
  realmManageModeDefault: t.Optional(t.Boolean()),
});

export type ModerationPreference =
  (typeof moderationPreferenceSchema)["static"];

export const subscriptionListPreferenceSchema = t.Object({
  defaultSort: t.Optional(userSubscriptionListSortSchema),
});

export type SubscriptionListPreference =
  (typeof subscriptionListPreferenceSchema)["static"];

export const subscriptionListsPreferenceSchema = t.Object({
  zones: t.Optional(subscriptionListPreferenceSchema),
  realms: t.Optional(subscriptionListPreferenceSchema),
});

export type SubscriptionListsPreference =
  (typeof subscriptionListsPreferenceSchema)["static"];

export const realmTagDisplayTargetSchema = t.Union([
  t.Literal(UnitType.BOOK),
  t.Literal(UnitType.GAME),
  t.Literal(UnitType.MEDIA),
]);

export type RealmTagDisplayTarget = CatalogUnitType;

export const realmTagPreferencesSchema = t.Object({
  [UnitType.BOOK]: t.Optional(realmTagPreferenceSchema),
  [UnitType.GAME]: t.Optional(realmTagPreferenceSchema),
  [UnitType.MEDIA]: t.Optional(realmTagPreferenceSchema),
});

export type RealmTagPreferences =
  (typeof realmTagPreferencesSchema)["static"];

/** Ratings a user may opt into; GENERAL/R_15 are always on. 用户可主动选择的分级；GENERAL/R_15 始终开启。 */
export const OPT_IN_RATINGS: readonly ContentRating[] = ["R_18", "R_18G"];

/** Always-on baseline ratings available to every caller, signed in or not. 对每个调用方（无论是否登录）始终开启的基线分级。 */
export const BASELINE_RATINGS: readonly ContentRating[] = ["GENERAL", "R_15"];

/** Library-surface display preferences (bookshelf grid, etc.). 书库界面的展示偏好（书架网格等）。 */
export const librarySettingsSchema = t.Object({
  bookshelf: t.Optional(bookshelfViewConfigSchema),
});

export type LibrarySettings = (typeof librarySettingsSchema)["static"];

export const USER_TAG_PRIVACY_FIELD_KEY = "userTags" as const;

export const PROFILE_FIELD_VISIBILITIES = [
  "private",
  "followers",
  "public",
] as const;

export const profileFieldVisibilitySchema = t.Union(
  PROFILE_FIELD_VISIBILITIES.map((visibility) => t.Literal(visibility)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);

export type ProfileFieldVisibility =
  (typeof profileFieldVisibilitySchema)["static"];

export const userProfilePrivacySchema = t.Object({
  [USER_TAG_PRIVACY_FIELD_KEY]: t.Optional(profileFieldVisibilitySchema),
});

export type UserProfilePrivacy = (typeof userProfilePrivacySchema)["static"];

/**
 * User-facing per-kind notification toggles. Each key gates a family of
 * notification kinds (see `notificationPreferenceKeyForKind` in the
 * notification module). A toggle is enabled by default when absent — only an
 * explicit `false` suppresses delivery. Enforced in the dispatch pipeline at
 * creation time (feed + push), not merely at read time.
 * 面向用户的按类型通知开关。每个键控制一组通知类型（参见 notification 模块中的
 * `notificationPreferenceKeyForKind`）。开关缺失时默认启用 — 只有显式的 `false`
 * 才会抑制投递。在分发流水线的创建时刻（feed + push）强制执行，而非仅在读取时。
 */
export const NOTIFICATION_PREFERENCE_KEYS = [
  "reply",
  "follow",
  "dm",
  "moderation",
  "realm",
  "system",
] as const;

export type NotificationPreferenceKey =
  (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export const notificationPreferenceSchema = t.Object({
  reply: t.Optional(t.Boolean()),
  follow: t.Optional(t.Boolean()),
  dm: t.Optional(t.Boolean()),
  moderation: t.Optional(t.Boolean()),
  realm: t.Optional(t.Boolean()),
  system: t.Optional(t.Boolean()),
});

export type NotificationPreference =
  (typeof notificationPreferenceSchema)["static"];

export const userSettingsSchema = t.Object({
  realmTagPreferences: t.Optional(realmTagPreferencesSchema),
  preferredLanguages: t.Optional(t.Array(contentLanguageSchema)),
  content: t.Optional(contentPreferenceSchema),
  publishing: t.Optional(publishingPreferenceSchema),
  moderation: t.Optional(moderationPreferenceSchema),
  subscriptionLists: t.Optional(subscriptionListsPreferenceSchema),
  library: t.Optional(librarySettingsSchema),
  notifications: t.Optional(notificationPreferenceSchema),
  privacy: t.Optional(userProfilePrivacySchema),
});

export type UserSettings = (typeof userSettingsSchema)["static"];

export const updateUserSettingsSchema = t.Partial(userSettingsSchema);

export type UpdateUserSettings = (typeof updateUserSettingsSchema)["static"];

// ============================================================
// USER BRIEF (lightweight — card/mention contexts)
// USER BRIEF（轻量 — 卡片/提及场景）
// ============================================================

export const userBriefSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. 用户的规范标识符 — USER 的 `Unit.id`。 */
  unitId: t.String(),
  name: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  avatar: t.Optional(t.String()),
});

export type UserBrief = (typeof userBriefSchema)["static"];

export const userBriefBatchRequestSchema = t.Object({
  /** Batch lookup keys — each entry is a USER `Unit.id`. 批量查询键 — 每个条目是一个 USER 的 `Unit.id`。 */
  unitIds: t.Array(t.String(), { maxItems: 200 }),
});

export type UserBriefBatchRequest =
  (typeof userBriefBatchRequestSchema)["static"];

export const userBriefBatchResponseSchema = t.Object({
  users: t.Array(userBriefSchema),
});

export type UserBriefBatchResponse =
  (typeof userBriefBatchResponseSchema)["static"];
