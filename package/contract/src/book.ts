import { t } from "elysia";
import { creationModeSchema } from "./content-authority";
import { contentDocWriteSchema } from "./content-doc-v1";
import {
  contentStructureDTOSchema,
  contentStructureNodeSchema,
  type ContentStructureItem,
  type ContentStructurePath,
  type ContentStructureResponse,
} from "./content-structure";
import { creditAttributionBriefSchema } from "./credit-attribution";
import { languageSchema } from "./language";
import { licenseSlugSchema } from "./license";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import {
  aiDisclosureDetailsSchema,
  aiDisclosureModeSchema,
  contentRatingSchema,
  publicUserSchema,
  unitTranslationDTOSchema,
} from "./unit";
import { unitWorkDTOSchema } from "./unit-work";

// ============================================================
// BOOK EXTRA SCHEMA
// ============================================================

export const bookExtraSchema = t.Object({
  publishURL: t.Optional(t.Array(t.String())),
});

export type BookExtra = (typeof bookExtraSchema)["static"];

// ============================================================
// BOOK DTO
// ============================================================

export const bookDTOSchema = t.Object({
  unitId: t.String(),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  workUnitId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(
    t.Object({
      uswn: t.Union([t.String(), t.Null()]),
    }),
  ),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),

  // Book extension fields
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  chapterCount: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(bookExtraSchema)),

  // Translation layer
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),

  // Work-domain release membership
  workMembership: t.Optional(t.Nullable(unitWorkDTOSchema)),

  // Credit attribution
  creditAttributions: t.Optional(t.Array(creditAttributionBriefSchema)),

  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  publishedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
});

export type BookDTO = (typeof bookDTOSchema)["static"];

// ============================================================
// BOOK LIST/QUERY
// ============================================================

export const bookListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  rating: t.Optional(contentRatingSchema),
  language: t.Optional(languageSchema),
  tagUnitIds: t.Optional(t.String()),
  entityId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn13: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()),
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
  limit: paginationLimitSchema,
});

export type BookListQuery = (typeof bookListQuerySchema)["static"];

export const bookListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  rating: t.Optional(contentRatingSchema),
  language: t.Optional(languageSchema),
  tagUnitIds: t.Optional(t.String()),
  entityId: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn13: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  status: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()),
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
  limit: paginationLimitSchema,
});

export type BookListBody = (typeof bookListBodySchema)["static"];

export const bookListResponseSchema = t.Object({
  books: t.Array(bookDTOSchema),
  total: t.Optional(t.Number()),
});

export type BookListResponse = (typeof bookListResponseSchema)["static"];

// ============================================================
// BOOK PARAMS/RESPONSE
// ============================================================

export const bookParamsSchema = t.Object({
  unitId: t.String(),
});

export type BookParams = (typeof bookParamsSchema)["static"];

export const bookResponseSchema = bookDTOSchema;
export type BookResponse = (typeof bookResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE BOOK
// ============================================================

export const createBookSchema = t.Object({
  userId: t.Optional(t.String()),
  creationMode: t.Optional(creationModeSchema),
  workMatch: t.Optional(
    t.Object({
      releaseUnitId: t.String(),
    }),
  ),
  defaultLanguage: t.Optional(languageSchema),
  isbn13: t.Optional(t.String()),
  publicationDate: t.Optional(t.Union([t.String(), t.Date()])),
  pageCount: t.Optional(t.Number()),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.String()),
  isLicensed: t.Optional(t.Boolean()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  coverUrl: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  visibility: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
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

export type CreateBookInput = (typeof createBookSchema)["static"];

export const updateBookSchema = t.Object({
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  coverUrl: t.Optional(t.Nullable(t.String())),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
  visibility: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateBookInput = (typeof updateBookSchema)["static"];

// ============================================================
// BOOK CONTENT STRUCTURE / CHAPTER TREE TYPES
// ============================================================

export const bookContentStructureNodeSchema = contentStructureNodeSchema;

/**
 * Path to a node occurrence in the current BookContentStructure forest.
 *
 * `[2, 4, 0]` means the first child of the fifth child of the third root node.
 * A path locates a node in the current JSON structure only; it is not a stable
 * global identity and may become stale after TOC edits or reordering.
 */
export type BookContentStructurePath = ContentStructurePath;

export type BookContentStructureItem = ContentStructureItem;

export const bookContentStructureDTOSchema = t.Object({
  bookUnitId: t.String(),
  ownerUnitId: t.Optional(t.String()),
  nodes: contentStructureDTOSchema.properties.nodes,
  createdAt: contentStructureDTOSchema.properties.createdAt,
  updatedAt: contentStructureDTOSchema.properties.updatedAt,
});

export type BookContentStructureDTO =
  (typeof bookContentStructureDTOSchema)["static"];

export interface BookContentStructureResponse
  extends Omit<ContentStructureResponse, "ownerUnitId"> {
  bookUnitId: string;
  ownerUnitId?: string;
}
