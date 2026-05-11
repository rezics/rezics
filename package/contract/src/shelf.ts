import { t } from "elysia";
import { languageSchema } from "./language";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

// ============================================================
// SHELF EXTRA SCHEMA
// ============================================================

export const shelfExtraSchema = t.Object({
  viewMode: t.Optional(t.String()),
});

export type ShelfExtra = (typeof shelfExtraSchema)["static"];

// ============================================================
// SHELF ITEM KIND
// ============================================================

export const shelfItemKindSchema = t.Union([
  t.Literal("book"),
  t.Literal("review"),
  t.Literal("quote"),
  t.Literal("post"),
  t.Literal("chapter"),
  t.Literal("shelf"),
  t.Literal("tag"),
  t.Literal("realm"),
  t.Literal("image"),
  t.Literal("video"),
  t.Literal("media"),
  t.Literal("game"),
  t.Literal("link"),
]);

export type ShelfItemKind = (typeof shelfItemKindSchema)["static"];

// ============================================================
// SHELF UNIT ROLE
// ============================================================

export const shelfUnitRoleSchema = t.Union([
  t.Literal("primary"),
  t.Literal("review"),
  t.Literal("tag"),
]);

export type ShelfUnitRole = (typeof shelfUnitRoleSchema)["static"];

// ============================================================
// SHELF UNIT DTO (junction row)
// ============================================================

export const shelfUnitDTOSchema = t.Object({
  shelfUnitId: t.String(),
  itemRef: t.String(),
  unitId: t.String(),
  role: shelfUnitRoleSchema,
});

export type ShelfUnitDTO = (typeof shelfUnitDTOSchema)["static"];

// ============================================================
// SHELF ITEM DTO
// ============================================================

// `reviewIds` / `tagIds` are server-projected from ShelfUnit rows for read
// convenience; authoritative storage is the ShelfUnit junction table.
export const shelfItemDTOSchema = t.Object({
  shelfUnitId: t.String(),
  itemRef: t.String(),
  kind: shelfItemKindSchema,
  position: t.String(),
  reviewIds: t.Array(t.String()),
  tagIds: t.Array(t.String()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ShelfItemDTO = (typeof shelfItemDTOSchema)["static"];

// ============================================================
// SHELF DTO
// ============================================================

export const shelfDTOSchema = t.Object({
  unitId: t.String(),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  kindKey: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(shelfExtraSchema)),
  itemCount: t.Optional(t.Number()),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  items: t.Optional(t.Array(shelfItemDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ShelfDTO = (typeof shelfDTOSchema)["static"];

// ============================================================
// SHELF SUMMARY DTO (for collection modal shelf list)
// ============================================================

export const shelfSummaryDTOSchema = t.Object({
  unitId: t.String(),
  userId: t.Optional(t.Nullable(t.String())),
  kindKey: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  title: t.Optional(t.Nullable(t.String())),
  itemCount: t.Number(),
  tags: t.Optional(
    t.Array(
      t.Object({
        tagUnitId: t.String(),
        score: t.Number(),
      }),
    ),
  ),
});

export type ShelfSummaryDTO = (typeof shelfSummaryDTOSchema)["static"];

// ============================================================
// SHELF DETAIL DTO
// ============================================================

export const shelfDetailDTOSchema = t.Object({
  ...shelfDTOSchema.properties,
  itemCount: t.Number(),
  tags: t.Optional(
    t.Array(
      t.Object({
        tagUnitId: t.String(),
        score: t.Number(),
      }),
    ),
  ),
});

export type ShelfDetailDTO = (typeof shelfDetailDTOSchema)["static"];

// ============================================================
// SHELF LIST/QUERY
// ============================================================

export const shelfListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  userId: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  containsItemRef: t.Optional(t.String()),
  language: t.Optional(languageSchema),
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
  limit: paginationLimitSchema,
});

export type ShelfListQuery = (typeof shelfListQuerySchema)["static"];

export const shelfListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  userId: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  containsItemRef: t.Optional(t.String()),
  language: t.Optional(languageSchema),
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
  limit: paginationLimitSchema,
});

export type ShelfListBody = (typeof shelfListBodySchema)["static"];

export const shelfListResponseSchema = t.Object({
  shelves: t.Array(shelfDTOSchema),
  total: t.Optional(t.Number()),
});

export type ShelfListResponse = (typeof shelfListResponseSchema)["static"];

// ============================================================
// SHELF PARAMS/RESPONSE
// ============================================================

export const shelfParamsSchema = t.Object({
  unitId: t.String(),
});

export type ShelfParams = (typeof shelfParamsSchema)["static"];

export const shelfResponseSchema = shelfDTOSchema;
export type ShelfResponse = (typeof shelfResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE SHELF
// ============================================================

export const createShelfSchema = t.Object({
  title: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  tagIds: t.Optional(t.Array(t.String())),
  coverUrl: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateShelfInput = (typeof createShelfSchema)["static"];

export const updateShelfSchema = t.Object({
  title: t.Optional(t.String()),
  kindKey: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  visibility: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateShelfInput = (typeof updateShelfSchema)["static"];

// ============================================================
// SHELF ITEM CRUD
// ============================================================

export const addShelfItemSchema = t.Object({
  itemRef: t.String(),
  kind: shelfItemKindSchema,
  tagIds: t.Optional(t.Array(t.String())),
  reviewIds: t.Optional(t.Array(t.String())),
});

export type AddShelfItemInput = (typeof addShelfItemSchema)["static"];

export const shelfItemParamsSchema = t.Object({
  shelfUnitId: t.String(),
  itemRef: t.String(),
});

export type ShelfItemParams = (typeof shelfItemParamsSchema)["static"];

export const shelfItemsQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export type ShelfItemsQuery = (typeof shelfItemsQuerySchema)["static"];

export const reorderShelfItemSchema = t.Object({
  beforeItemRef: t.Optional(t.String()),
  afterItemRef: t.Optional(t.String()),
});

export type ReorderShelfItemInput = (typeof reorderShelfItemSchema)["static"];

export const attachReviewSchema = t.Object({
  reviewUnitId: t.String(),
});

export type AttachReviewInput = (typeof attachReviewSchema)["static"];

export const detachReviewSchema = t.Object({
  reviewUnitId: t.String(),
});

export type DetachReviewInput = (typeof detachReviewSchema)["static"];

export const setShelfItemTagsSchema = t.Object({
  tagIds: t.Array(t.String()),
});

export type SetShelfItemTagsInput = (typeof setShelfItemTagsSchema)["static"];

export const cleanupShelfOrphansSchema = t.Object({
  orphanItemRefs: t.Array(t.String()),
});

export type CleanupShelfOrphansInput =
  (typeof cleanupShelfOrphansSchema)["static"];

// ============================================================
// SHELF ITEM BATCH OPS
// ============================================================

export const shelfItemBatchAddOpSchema = t.Object({
  op: t.Literal("add"),
  itemRef: t.String(),
  kind: shelfItemKindSchema,
  position: t.String(),
  tagIds: t.Optional(t.Array(t.String())),
  reviewIds: t.Optional(t.Array(t.String())),
});

export type ShelfItemBatchAddOp = (typeof shelfItemBatchAddOpSchema)["static"];

export const shelfItemBatchReorderOpSchema = t.Object({
  op: t.Literal("reorder"),
  itemRef: t.String(),
  position: t.String(),
});

export type ShelfItemBatchReorderOp =
  (typeof shelfItemBatchReorderOpSchema)["static"];

export const shelfItemBatchReorderToPageOpSchema = t.Object({
  op: t.Literal("reorderToPage"),
  itemRef: t.String(),
  toPage: t.Number(),
  edge: t.Literal("first"),
  pageSize: t.Optional(t.Number()),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export type ShelfItemBatchReorderToPageOp =
  (typeof shelfItemBatchReorderToPageOpSchema)["static"];

export const shelfItemBatchDeleteOpSchema = t.Object({
  op: t.Literal("delete"),
  itemRef: t.String(),
});

export type ShelfItemBatchDeleteOp =
  (typeof shelfItemBatchDeleteOpSchema)["static"];

export const shelfItemBatchSetTagsOpSchema = t.Object({
  op: t.Literal("setTags"),
  itemRef: t.String(),
  tagIds: t.Array(t.String()),
});

export type ShelfItemBatchSetTagsOp =
  (typeof shelfItemBatchSetTagsOpSchema)["static"];

export const shelfItemBatchOpSchema = t.Union([
  shelfItemBatchAddOpSchema,
  shelfItemBatchReorderOpSchema,
  shelfItemBatchReorderToPageOpSchema,
  shelfItemBatchDeleteOpSchema,
  shelfItemBatchSetTagsOpSchema,
]);

export type ShelfItemBatchOp = (typeof shelfItemBatchOpSchema)["static"];

export const shelfItemBatchRequestSchema = t.Object({
  ops: t.Array(shelfItemBatchOpSchema),
  baseVersion: t.Optional(t.String()),
});

export type ShelfItemBatchRequest =
  (typeof shelfItemBatchRequestSchema)["static"];

export const shelfItemBatchResultSchema = t.Union([
  t.Object({
    status: t.Literal("ok"),
    op: shelfItemBatchOpSchema,
    item: t.Optional(shelfItemDTOSchema),
  }),
  t.Object({
    status: t.Literal("failed"),
    op: shelfItemBatchOpSchema,
    reason: t.String(),
  }),
]);

export type ShelfItemBatchResult =
  (typeof shelfItemBatchResultSchema)["static"];

export const shelfItemBatchResponseSchema = t.Object({
  results: t.Array(shelfItemBatchResultSchema),
});

export type ShelfItemBatchResponse =
  (typeof shelfItemBatchResponseSchema)["static"];

// ============================================================
// COLLECTION API
// ============================================================

export const collectInputSchema = t.Object({
  targetId: t.String(),
  shelfIds: t.Array(t.String()),
  independent: t.Optional(t.Boolean()),
});

export type CollectInput = (typeof collectInputSchema)["static"];

export const collectResponseSchema = t.Object({
  savedTo: t.Array(t.String()),
  isNew: t.Boolean(),
});

export type CollectResponse = (typeof collectResponseSchema)["static"];

export const toggleFavoriteInputSchema = t.Object({
  targetId: t.String(),
});

export type ToggleFavoriteInput = (typeof toggleFavoriteInputSchema)["static"];

export const toggleFavoriteResponseSchema = t.Object({
  isFavorited: t.Boolean(),
});

export type ToggleFavoriteResponse =
  (typeof toggleFavoriteResponseSchema)["static"];

export const collectionStatusResponseSchema = t.Object({
  isFavorited: t.Boolean(),
  shelves: t.Array(
    t.Object({
      id: t.String(),
      title: t.Optional(t.Nullable(t.String())),
    }),
  ),
});

export type CollectionStatusResponse =
  (typeof collectionStatusResponseSchema)["static"];
