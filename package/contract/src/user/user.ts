import { t } from "elysia";
import { bookshelfViewConfigSchema } from "../shelf/bookshelf";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { licenseSlugSchema } from "../license";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import type { ContentRating } from "../unit/unit";

// ============================================================
// USER DTO (UserType removed — no AUTHOR/PRESS/PRODUCER)
// ============================================================

export const userDTOSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. */
  unitId: t.String(),
  email: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  name: t.Optional(t.String()),
  avatar: t.Optional(t.String()),
  bio: t.Optional(t.String()),
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
  avatar: t.Optional(t.String()),
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
  avatar: t.Optional(t.Nullable(t.String())),
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
// ============================================================

export const realmTagPreferenceSchema = t.Object({
  realmIds: t.Array(t.String(), { maxItems: 50 }),
  maxDisplay: t.Number(),
});

export const contentPreferenceSchema = t.Object({
  /**
   * Age-rating opt-ins. Only R_18 / R_18G are valid values — GENERAL and R_15
   * are always-on baseline and MUST NOT appear here.
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
   */
  realmManageModeDefault: t.Optional(t.Boolean()),
});

export type ModerationPreference =
  (typeof moderationPreferenceSchema)["static"];

/** Ratings a user may opt into; GENERAL/R_15 are always on. */
export const OPT_IN_RATINGS: readonly ContentRating[] = ["R_18", "R_18G"];

/** Always-on baseline ratings available to every caller, signed in or not. */
export const BASELINE_RATINGS: readonly ContentRating[] = ["GENERAL", "R_15"];

/** Library-surface display preferences (bookshelf grid, etc.). */
export const librarySettingsSchema = t.Object({
  bookshelf: t.Optional(bookshelfViewConfigSchema),
});

export type LibrarySettings = (typeof librarySettingsSchema)["static"];

export const USER_TAG_PRIVACY_FIELD_KEY = "userTags" as const;

export const profileFieldVisibilitySchema = t.Union([
  t.Literal("private"),
  t.Literal("followers"),
  t.Literal("public"),
]);

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
  realmTagPreferences: t.Optional(
    t.Record(t.String(), realmTagPreferenceSchema),
  ),
  preferredLanguages: t.Optional(t.Array(t.String())),
  content: t.Optional(contentPreferenceSchema),
  publishing: t.Optional(publishingPreferenceSchema),
  moderation: t.Optional(moderationPreferenceSchema),
  library: t.Optional(librarySettingsSchema),
  notifications: t.Optional(notificationPreferenceSchema),
  privacy: t.Optional(userProfilePrivacySchema),
});

export type UserSettings = (typeof userSettingsSchema)["static"];

export const updateUserSettingsSchema = t.Partial(userSettingsSchema);

export type UpdateUserSettings = (typeof updateUserSettingsSchema)["static"];

// ============================================================
// USER BRIEF (lightweight — card/mention contexts)
// ============================================================

export const userBriefSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. */
  unitId: t.String(),
  name: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  avatar: t.Optional(t.String()),
});

export type UserBrief = (typeof userBriefSchema)["static"];

export const userBriefBatchRequestSchema = t.Object({
  /** Batch lookup keys — each entry is a USER `Unit.id`. */
  unitIds: t.Array(t.String(), { maxItems: 200 }),
});

export type UserBriefBatchRequest =
  (typeof userBriefBatchRequestSchema)["static"];

export const userBriefBatchResponseSchema = t.Object({
  users: t.Array(userBriefSchema),
});

export type UserBriefBatchResponse =
  (typeof userBriefBatchResponseSchema)["static"];
