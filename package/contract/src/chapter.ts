import { t } from "elysia";

// ============================================================
// CHAPTER CONTRACTS
// Chapters are Unit(type=CHAPTER). BookIndex stores the chapter tree as JSON.
// ============================================================

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

export const chapterListDTOSchema = t.Object({
  order: t.Optional(
    t.Union([t.Array(t.Number()), t.Array(t.Array(t.Number()))]),
  ),
  chapters: t.Array(chapterListItemSchema),
});

export type ChapterListDTO = (typeof chapterListDTOSchema)["static"];

export const chapterParamsSchema = t.Object({
  unitId: t.String(),
});

export type ChapterParams = (typeof chapterParamsSchema)["static"];

export const chapterListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  status: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  targetUnitIds: t.Optional(t.String()),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
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

export type ChapterListQuery = (typeof chapterListQuerySchema)["static"];

export const chapterListResponseSchema = t.Object({
  items: t.Array(chapterListItemSchema),
  total: t.Optional(t.Number()),
});

export type ChapterListResponse = (typeof chapterListResponseSchema)["static"];

export const chapterResponseSchema = chapterDetailSchema;
export type ChapterResponse = (typeof chapterResponseSchema)["static"];

export const createChapterSchema = t.Object({
  userId: t.String(),
  title: t.String(),
  content: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  status: t.Optional(t.String()),
});

export type CreateChapterInput = (typeof createChapterSchema)["static"];

export const updateChapterSchema = t.Object({
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  status: t.Optional(t.String()),
});

export type UpdateChapterInput = (typeof updateChapterSchema)["static"];
