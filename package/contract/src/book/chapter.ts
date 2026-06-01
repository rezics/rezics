import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  aiDisclosureDetailsSchema,
  aiDisclosureModeSchema,
  contentRatingSchema,
} from "../unit/unit";

// ============================================================
// CHAPTER CONTRACTS
// Chapter = Unit(type=POST) + Post(kind=CHAPTER, targetUnitId=<book>).
// Content lives in Post.content. Title lives in UnitTranslation.title.
// Cover (optional) lives in UnitTranslation.extra.coverUrl
// (see unitTranslationExtraSchema). BookContentStructure JSON stores chapter order.
// ============================================================

export const chapterListItemSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  noContent: t.Boolean(),
  userId: t.Optional(t.String()),
  coverUrl: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ChapterListItemDTO = (typeof chapterListItemSchema)["static"];

export const chapterDetailSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  content: t.Optional(t.Nullable(contentDocSchema)),
  userId: t.Optional(t.String()),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
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

export const chapterMaterializeByBookPathParamsSchema = t.Object({
  bookUnitId: t.String(),
});

export type ChapterMaterializeByBookPathParams =
  (typeof chapterMaterializeByBookPathParamsSchema)["static"];

export const chapterListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
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
  limit: paginationLimitSchema,
});

export type ChapterListQuery = (typeof chapterListQuerySchema)["static"];

export const chapterListBodySchema = t.Object({
  ...listPostBodyBase.properties,
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
  limit: paginationLimitSchema,
});

export type ChapterListBody = (typeof chapterListBodySchema)["static"];

export const chapterListResponseSchema = t.Object({
  items: t.Array(chapterListItemSchema),
  total: t.Optional(t.Number()),
});

export type ChapterListResponse = (typeof chapterListResponseSchema)["static"];

export const chapterResponseSchema = chapterDetailSchema;
export type ChapterResponse = (typeof chapterResponseSchema)["static"];

export const chapterMaterializationRequestSchema = t.Object({
  // The target ContentStructureNode.id. Node ids are stable uuidv7 values, so
  // they cannot drift under a TOC reorder — no stale-path guards are needed.
  nodeId: t.String(),
});

export type ChapterMaterializationRequest =
  (typeof chapterMaterializationRequestSchema)["static"];

export const chapterMaterializationResponseSchema = t.Object({
  bookUnitId: t.String(),
  nodeId: t.String(),
  contentUnitId: t.String(),
  /** @deprecated Use contentUnitId. */
  chapterUnitId: t.String(),
  alreadyMaterialized: t.Boolean(),
  bookContentStructureUpdatedAt: t.Union([t.String(), t.Date()]),
});

export type ChapterMaterializationResponse =
  (typeof chapterMaterializationResponseSchema)["static"];

export const createChapterSchema = t.Object({
  userId: t.String(),
  title: t.String(),
  content: t.Optional(contentDocWriteSchema),
  // The parent book unit id (Unit.targetUnitId after persistence).
  // MUST resolve to a Unit(type=BOOK) — server rejects otherwise.
  targetUnitId: t.String(),
  coverUrl: t.Optional(t.String()),
  status: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
});

export type CreateChapterInput = (typeof createChapterSchema)["static"];

export const updateChapterSchema = t.Object({
  title: t.Optional(t.String()),
  content: t.Optional(contentDocWriteSchema),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  status: t.Optional(t.String()),
  rating: t.Optional(contentRatingSchema),
  aiDisclosureMode: t.Optional(aiDisclosureModeSchema),
  aiDisclosureDetails: t.Optional(t.Nullable(aiDisclosureDetailsSchema)),
});

export type UpdateChapterInput = (typeof updateChapterSchema)["static"];
