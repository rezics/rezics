import { t } from "elysia";
import { languageSchema } from "./language";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";

// ============================================================
// ENUMS
// ============================================================

export const UnitType = {
  BOOK: "BOOK",
  GAME: "GAME",
  MEDIA: "MEDIA",
  POST: "POST",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
} as const;

export const UnitStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

export const UnitVisibility = {
  PUBLIC: "PUBLIC",
  UNLISTED: "UNLISTED",
  PRIVATE: "PRIVATE",
} as const;

export const unitTypeSchema = t.Union([
  t.Literal("BOOK"),
  t.Literal("GAME"),
  t.Literal("MEDIA"),
  t.Literal("POST"),
  t.Literal("TAG"),
  t.Literal("REALM"),
  t.Literal("SHELF"),
  t.Literal("IMAGE"),
  t.Literal("VIDEO"),
  t.Literal("QUOTE"),
  t.Literal("LINK"),
]);

/**
 * Unit types where cross-user contribution to a Work's Releases is permitted
 * without an explicit work-side approval step. Used by the work-link service
 * to short-circuit the WorkLinkClaim flow for catalog-style content.
 */
export const WIKI_TYPES = ["BOOK", "GAME", "MEDIA"] as const;

export type WikiType = (typeof WIKI_TYPES)[number];

export const wikiTypeSchema = t.Union([
  t.Literal("BOOK"),
  t.Literal("GAME"),
  t.Literal("MEDIA"),
]);

export const unitStatusSchema = t.Union([
  t.Literal("DRAFT"),
  t.Literal("PUBLISHED"),
  t.Literal("ARCHIVED"),
  t.Literal("DELETED"),
]);

export const unitVisibilitySchema = t.Union([
  t.Literal("PUBLIC"),
  t.Literal("UNLISTED"),
  t.Literal("PRIVATE"),
]);

// ============================================================
// CONTENT RATING
// ============================================================

export const ContentRating = {
  GENERAL: "GENERAL",
  R_15: "R_15",
  R_18: "R_18",
  R_18G: "R_18G",
} as const;

export type ContentRating = (typeof ContentRating)[keyof typeof ContentRating];

export const contentRatingSchema = t.Union([
  t.Literal("GENERAL"),
  t.Literal("R_15"),
  t.Literal("R_18"),
  t.Literal("R_18G"),
]);

// ============================================================
// PUBLIC USER (shared across contracts)
// ============================================================

export const publicUserSchema = t.Object({
  userId: t.String(),
  slug: t.Optional(t.String()),
  name: t.Optional(t.String()),
  avatar: t.Optional(t.Nullable(t.String())),
  bio: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  followersCount: t.Optional(t.Number()),
  followingsCount: t.Optional(t.Number()),
});

export type PublicUser = (typeof publicUserSchema)["static"];

// ============================================================
// UNIT TRANSLATION DTO
// ============================================================

export const unitTranslationDTOSchema = t.Object({
  unitId: t.String(),
  language: languageSchema,
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceReleaseUnitId: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitTranslationDTO = (typeof unitTranslationDTOSchema)["static"];

export const unitSupportLanguageDTOSchema = t.Object({
  unitId: t.String(),
  language: languageSchema,
  isPrimary: t.Boolean(),
  sortOrder: t.Number(),
});

export type UnitSupportLanguageDTO =
  (typeof unitSupportLanguageDTOSchema)["static"];

// ============================================================
// UNIT DTO
// ============================================================

export const baseUnitSchema = t.Object({
  id: t.String(),
  type: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  workUnitId: t.Optional(t.Nullable(t.String())),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  translationGroupId: t.Optional(t.Nullable(t.String())),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type BaseUnit = (typeof baseUnitSchema)["static"];

export const unitDTOSchema = t.Object({
  ...baseUnitSchema.properties,
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  supportLanguages: t.Optional(t.Array(unitSupportLanguageDTOSchema)),
  reactionSummaries: t.Optional(t.Any()),
});

export type UnitDTO = (typeof unitDTOSchema)["static"];

// ============================================================
// UNIT LIST/QUERY
// ============================================================

export const unitListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  rating: t.Optional(contentRatingSchema),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  publishedAtFrom: t.Optional(t.String()),
  publishedAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type UnitListQuery = (typeof unitListQuerySchema)["static"];

export const unitListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  q: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  rating: t.Optional(contentRatingSchema),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  publishedAtFrom: t.Optional(t.String()),
  publishedAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type UnitListBody = (typeof unitListBodySchema)["static"];

export const unitListResponseSchema = t.Object({
  units: t.Array(unitDTOSchema),
  total: t.Optional(t.Number()),
});

export type UnitListResponse = (typeof unitListResponseSchema)["static"];

export const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export type UnitParams = (typeof unitParamsSchema)["static"];

export const unitResponseSchema = unitDTOSchema;
export type UnitResponse = (typeof unitResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE UNIT
// ============================================================

export const createUnitSchema = t.Object({
  userId: t.Optional(t.String()),
  type: t.String(),
  workUnitId: t.Optional(t.String()),
  defaultLanguage: t.Optional(languageSchema),
  isLanguageNeutral: t.Optional(t.Boolean()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  publishedAt: t.Optional(t.Union([t.String(), t.Date()])),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(t.String()),
        extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
        sourceReleaseUnitId: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateUnitInput = (typeof createUnitSchema)["static"];

export const updateUnitSchema = t.Object({
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  defaultLanguage: t.Optional(languageSchema),
  isLanguageNeutral: t.Optional(t.Boolean()),
  workUnitId: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type UpdateUnitInput = (typeof updateUnitSchema)["static"];

// ============================================================
// TRANSLATION CRUD
// ============================================================

export const createTranslationSchema = t.Object({
  language: languageSchema,
  title: t.Optional(t.String()),
  subtitle: t.Optional(t.String()),
  summary: t.Optional(t.String()),
  description: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceReleaseUnitId: t.Optional(t.String()),
});

export type CreateTranslationInput = (typeof createTranslationSchema)["static"];

export const updateTranslationSchema = t.Object({
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceReleaseUnitId: t.Optional(t.Nullable(t.String())),
});

export type UpdateTranslationInput = (typeof updateTranslationSchema)["static"];

export const translationParamsSchema = t.Object({
  unitId: t.String(),
  language: languageSchema,
});

export type TranslationParams = (typeof translationParamsSchema)["static"];
