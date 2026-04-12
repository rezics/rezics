import { t } from "elysia";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

// ============================================================
// PERSON/ORG CREDIT BRIEFS (inline for BookDTO)
// ============================================================

export const personCreditBriefSchema = t.Object({
  personId: t.String(),
  name: t.String(),
  roleKey: t.String(),
  sortOrder: t.Optional(t.Number()),
});

export const orgCreditBriefSchema = t.Object({
  organizationId: t.String(),
  name: t.String(),
  roleKey: t.String(),
  sortOrder: t.Optional(t.Number()),
});

// ============================================================
// SCORED TAG BRIEF (inline for BookDTO)
// ============================================================

export const scoredTagBriefSchema = t.Object({
  tagUnitId: t.String(),
  label: t.Optional(t.String()),
  score: t.Number(),
  voteCount: t.Optional(t.Number()),
});

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
  defaultLanguage: t.Optional(t.Nullable(t.String())),
  isLanguageNeutral: t.Optional(t.Boolean()),

  // Book extension fields
  isbn13: t.Optional(t.Nullable(t.String())),
  publicationDate: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  pageCount: t.Optional(t.Nullable(t.Number())),
  textLength: t.Optional(t.Number()),
  formatKey: t.Optional(t.Nullable(t.String())),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),

  // Translation layer
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),

  // Attribution
  personCredits: t.Optional(t.Array(personCreditBriefSchema)),
  orgCredits: t.Optional(t.Array(orgCreditBriefSchema)),

  // Tags (scored)
  tags: t.Optional(t.Array(scoredTagBriefSchema)),

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
  q: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  language: t.Optional(t.String()),
  tagUnitIds: t.Optional(t.String()),
  personId: t.Optional(t.String()),
  organizationId: t.Optional(t.String()),
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
  limit: t.Optional(t.Number()),
});

export type BookListQuery = (typeof bookListQuerySchema)["static"];

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
  defaultLanguage: t.Optional(t.String()),
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
        language: t.String(),
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

export interface ChapterTreeItem {
  id: string;
  title: string;
  noContent: boolean;
  children?: ChapterTreeItem[];
}

export interface ChapterIndexResponse {
  bookUnitId: string;
  index: ChapterTreeItem[];
  createdAt: Date;
  updatedAt: Date;
}
