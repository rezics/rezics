import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";

// ============================================================
// ENUMS
// ============================================================

export const UnitType = {
  BOOK: "BOOK",
  GAME: "GAME",
  MEDIA: "MEDIA",
  POST: "POST",
  COMMENT: "COMMENT",
  TAG: "TAG",
  REALM: "REALM",
  SHELF: "SHELF",
  SERIES: "SERIES",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  QUOTE: "QUOTE",
  LINK: "LINK",
  LABEL: "LABEL",
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

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
  t.Literal("COMMENT"),
  t.Literal("TAG"),
  t.Literal("REALM"),
  t.Literal("SHELF"),
  t.Literal("SERIES"),
  t.Literal("IMAGE"),
  t.Literal("VIDEO"),
  t.Literal("QUOTE"),
  t.Literal("LINK"),
  t.Literal("LABEL"),
]);

/**
 * Unit types that participate in collaborative catalog/wiki editing.
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
// AI DISCLOSURE
// ============================================================

export const AiDisclosureMode = {
  UNKNOWN: "UNKNOWN",
  NONE: "NONE",
  AI_ASSISTED: "AI_ASSISTED",
  AI_ORIGINATED: "AI_ORIGINATED",
  MACHINE_GENERATED: "MACHINE_GENERATED",
} as const;

export type AiDisclosureMode =
  (typeof AiDisclosureMode)[keyof typeof AiDisclosureMode];

export const aiDisclosureModeSchema = t.Union([
  t.Literal("UNKNOWN"),
  t.Literal("NONE"),
  t.Literal("AI_ASSISTED"),
  t.Literal("AI_ORIGINATED"),
  t.Literal("MACHINE_GENERATED"),
]);

export const CatalogEntryKind = {
  MAIN: "MAIN",
  VARIANT: "VARIANT",
  NONE: "NONE",
} as const;

export type CatalogEntryKind =
  (typeof CatalogEntryKind)[keyof typeof CatalogEntryKind];

export const catalogEntryKindSchema = t.Union([
  t.Literal("MAIN"),
  t.Literal("VARIANT"),
  t.Literal("NONE"),
]);

export const aiDisclosureSourceSchema = t.Union([
  t.Literal("USER"),
  t.Literal("MODERATOR"),
  t.Literal("SYSTEM"),
  t.Literal("IMPORT"),
]);

export const aiDisclosureSourceStandardSchema = t.Union([
  t.Literal("C2PA"),
  t.Literal("IPTC"),
  t.Literal("SELF_DECLARED"),
  t.Literal("OTHER"),
]);

export const aiDisclosureDetailsSchema = t.Object(
  {
    model: t.Optional(t.String()),
    provider: t.Optional(t.String()),
    reviewedByHuman: t.Optional(t.Boolean()),
    disclosedBy: t.Optional(aiDisclosureSourceSchema),
    sourceStandard: t.Optional(aiDisclosureSourceStandardSchema),
  },
  { additionalProperties: false },
);

export type AiDisclosureDetails = (typeof aiDisclosureDetailsSchema)["static"];

// ============================================================
// PUBLIC USER (shared across contracts)
// ============================================================

export const publicUserSchema = t.Object({
  /** Canonical user identifier — the USER `Unit.id`. */
  unitId: t.String(),
  slug: t.Optional(t.String()),
  name: t.Optional(t.String()),
  avatar: t.Optional(t.Nullable(t.String())),
  bio: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
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
  description: t.Optional(t.Nullable(contentDocSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitTranslationDTO = (typeof unitTranslationDTOSchema)["static"];

// ============================================================
// UNIT PUBLICATION METADATA
// ============================================================

export const unitPublicationMetadataSchema = t.Object({
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
});

export type UnitPublicationMetadata =
  (typeof unitPublicationMetadataSchema)["static"];

export const publishableUnitInputSchema = t.Object({
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
});

export type PublishableUnitInput =
  (typeof publishableUnitInputSchema)["static"];

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
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
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
});

export type UnitDTO = (typeof unitDTOSchema)["static"];

// ============================================================
// UNIT LIST/QUERY
// ============================================================

export const unitListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  id: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  title: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
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
  id: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  title: t.Optional(t.String()),
  type: t.Optional(t.String()),
  types: t.Optional(t.String()),
  excludeTypes: t.Optional(t.String()),
  status: t.Optional(t.String()),
  statuses: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
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
  defaultLanguage: t.Optional(languageSchema),
  isLanguageNeutral: t.Optional(t.Boolean()),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  publishedAt: t.Optional(t.Union([t.String(), t.Date()])),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(contentDocWriteSchema),
        extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
        sourceUnitId: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateUnitInput = (typeof createUnitSchema)["static"];

export const updateUnitSchema = t.Object({
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  catalogEntryKind: t.Optional(t.Nullable(catalogEntryKindSchema)),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  defaultLanguage: t.Optional(languageSchema),
  isLanguageNeutral: t.Optional(t.Boolean()),
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
  description: t.Optional(contentDocWriteSchema),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.String()),
});

export type CreateTranslationInput = (typeof createTranslationSchema)["static"];

export const updateTranslationSchema = t.Object({
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocWriteSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  sourceUnitId: t.Optional(t.Nullable(t.String())),
});

export type UpdateTranslationInput = (typeof updateTranslationSchema)["static"];

export const translationParamsSchema = t.Object({
  unitId: t.String(),
  language: languageSchema,
});

export type TranslationParams = (typeof translationParamsSchema)["static"];
