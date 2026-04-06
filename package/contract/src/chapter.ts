import { t } from "elysia";

/**
 * Chapter contracts (server <-> client)
 * Notes:
 * - Chapters are modeled as Unit(type = 'CHAPTER')
 * - Book-to-chapter tree (ChapterIndex) is maintained by the Book service
 * - This contract focuses on CRUD for a single chapter Unit and rich list queries
 */

// ========== DTOs ==========

export const chapterListItemSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  noContent: t.Boolean(),
  userId: t.Optional(t.String()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ChapterListItemDTO = (typeof chapterListItemSchema)["static"];

export const chapterDetailSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  content: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ChapterDetailDTO = (typeof chapterDetailSchema)["static"];

// Backward-compat DTO for list shape used by some clients
export const chapterListDTOSchema = t.Object({
  order: t.Optional(
    t.Union([t.Array(t.Number()), t.Array(t.Array(t.Number()))]),
  ),
  chapters: t.Array(chapterListItemSchema),
});
export type ChapterListDTO = (typeof chapterListDTOSchema)["static"];

// ========== Query/Params/Responses ==========

export const chapterParamsSchema = t.Object({
  unitId: t.String(),
});
export type ChapterParams = (typeof chapterParamsSchema)["static"];

export const chapterListQuerySchema = t.Object({
  q: t.Optional(t.String()), // search title/content
  userId: t.Optional(t.String()),
  tag: t.Optional(t.String()),
  tags: t.Optional(t.String()), // comma separated
  status: t.Optional(t.String()), // e.g. ACTIVE,DRAFT
  targetUnitId: t.Optional(t.String()), // book/chapter id this chapter targets
  targetUnitIds: t.Optional(t.String()), // CSV
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()), // createdAt | updatedAt
      order: t.Optional(t.String()), // asc | desc
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
export type ChapterListQuery = (typeof chapterListQuerySchema)["static"];

export const chapterListResponseSchema = t.Object({
  items: t.Array(chapterListItemSchema),
  total: t.Optional(t.Number()),
});
export type ChapterListResponse = (typeof chapterListResponseSchema)["static"];

export const chapterResponseSchema = chapterDetailSchema;
export type ChapterResponse = (typeof chapterResponseSchema)["static"];

// ========== Create/Update ==========

export const createChapterSchema = t.Object({
  userId: t.String(),
  title: t.String(),
  content: t.Optional(t.String()),
  // optional soft link to a book or a parent chapter (maintained by book service normally)
  targetUnitId: t.Optional(t.String()),
  // arbitrary extension data
  metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  status: t.Optional(t.String()), // UnitStatus, validated server-side
});
export type CreateChapterInput = (typeof createChapterSchema)["static"];

export const updateChapterSchema = t.Object({
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  status: t.Optional(t.String()),
});
export type UpdateChapterInput = (typeof updateChapterSchema)["static"];
