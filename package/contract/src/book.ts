import { t } from "elysia";
import { attributionBriefSchema } from "./attribution";
import { languageSchema } from "./language";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

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
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  defaultLanguage: t.Optional(t.Nullable(languageSchema)),
  isLanguageNeutral: t.Optional(t.Boolean()),

  // Book extension fields
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(bookExtraSchema)),

  // Translation layer
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),

  // Attribution
  attributions: t.Optional(t.Array(attributionBriefSchema)),

  // Engagement
  reactionSummaries: t.Optional(t.Any()),

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
  nsfw: t.Optional(t.Boolean()),
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
  nsfw: t.Optional(t.Boolean()),
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
  defaultLanguage: t.Optional(languageSchema),
  isbn13: t.Optional(t.String()),
  publicationDate: t.Optional(t.Union([t.String(), t.Date()])),
  pageCount: t.Optional(t.Number()),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.String()),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
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
        description: t.Optional(t.String()),
        extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
        sourceReleaseUnitId: t.Optional(t.String()),
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
  coverUrl: t.Optional(t.Nullable(t.String())),
  nsfw: t.Optional(t.Boolean()),
  visibility: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateBookInput = (typeof updateBookSchema)["static"];

// ============================================================
// CHAPTER TYPES (preserved from old schema)
// ============================================================

export const bookIndexNodeSchema: ReturnType<typeof t.Recursive> = t.Recursive(
  (self) =>
    t.Object({
      id: t.String(),
      title: t.String(),
      noContent: t.Boolean(),
      children: t.Optional(t.Array(self)),
    }),
);

export interface ChapterTreeItem {
  id: string;
  title: string;
  noContent: boolean;
  children?: ChapterTreeItem[];
}

export const bookIndexDTOSchema = t.Object({
  bookUnitId: t.String(),
  index: t.Array(bookIndexNodeSchema),
  createdAt: t.Union([t.String(), t.Date()]),
  updatedAt: t.Union([t.String(), t.Date()]),
});

export type BookIndexDTO = (typeof bookIndexDTOSchema)["static"];

export interface ChapterIndexResponse {
  bookUnitId: string;
  index: ChapterTreeItem[];
  createdAt: Date;
  updatedAt: Date;
}
