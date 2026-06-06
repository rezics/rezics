import { t } from "elysia";
import { contentDocWriteSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import { licenseSlugSchema } from "../license";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import {
  publicUserSchema,
  unitTranslationDTOSchema,
  variantContextSummarySchema,
} from "../unit/unit";

// ============================================================
// SHELF EXTRA SCHEMA
// ============================================================

export const shelfExtraSchema = t.Object({
  viewMode: t.Optional(t.String()),
});

export type ShelfExtra = (typeof shelfExtraSchema)["static"];

export const shelfCoverImageSpec = {
  aspectRatio: "16 / 9",
  width: 16,
  height: 9,
} as const;

// ============================================================
// SHELF ITEM KIND
// ============================================================

export const shelfItemTypeSchema = t.Union([
  t.Literal("unit"),
  t.Literal("comment"),
]);

export type ShelfItemType = (typeof shelfItemTypeSchema)["static"];

export const shelfItemKindSchema = t.Union([
  t.Literal("book"),
  t.Literal("review"),
  t.Literal("comment"),
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
// SHELF ITEM PARENT ROLE
// ============================================================

export const shelfItemParentRoleSchema = t.Union([
  t.Literal("review"),
  t.Literal("comment"),
  t.Literal("tag"),
  t.Literal("annotation"),
]);

export type ShelfItemParentRole = (typeof shelfItemParentRoleSchema)["static"];

// ============================================================
// SHELF ITEM DTO
// ============================================================

export const shelfItemDTOSchema = t.Object(
  {
    shelfId: t.String(),
    itemType: shelfItemTypeSchema,
    itemId: t.String(),
    variantUnitId: t.Optional(t.Nullable(t.String())),
    variantContext: t.Optional(t.Nullable(variantContextSummarySchema)),
    kind: shelfItemKindSchema,
    parentItemType: t.Optional(t.Nullable(shelfItemTypeSchema)),
    parentItemId: t.Optional(t.Nullable(t.String())),
    parentRole: t.Optional(t.Nullable(shelfItemParentRoleSchema)),
    position: t.String(),
    searchText: t.Optional(t.Nullable(t.String())),
    createdByUserId: t.Optional(t.Nullable(t.String())),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type ShelfItemDTO = (typeof shelfItemDTOSchema)["static"];

// ============================================================
// SHELF ITEM CHILD CONTEXT DTO
// ============================================================

export const shelfItemChildDTOSchema = t.Object(
  {
    shelfId: t.String(),
    parentItemType: shelfItemTypeSchema,
    parentItemId: t.String(),
    childItemType: shelfItemTypeSchema,
    childItemId: t.String(),
    role: shelfItemParentRoleSchema,
  },
  { additionalProperties: false },
);

export type ShelfItemChildDTO = (typeof shelfItemChildDTOSchema)["static"];

export const shelfMatchedUnitDTOSchema = t.Object({
  itemType: t.Optional(shelfItemTypeSchema),
  itemId: t.Optional(t.String()),
  unitId: t.String(),
  kind: shelfItemKindSchema,
  title: t.Optional(t.Nullable(t.String())),
});

export type ShelfMatchedUnitDTO = (typeof shelfMatchedUnitDTOSchema)["static"];

// ============================================================
// SHELF DTO
// ============================================================

export const shelfDTOSchema = t.Object({
  unitId: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  status: t.Optional(t.String()),
  visibility: t.Optional(t.String()),
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  kindKey: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(shelfExtraSchema)),
  rootItemCount: t.Optional(t.Number()),
  itemCount: t.Optional(t.Number()),
  matchedUnit: t.Optional(t.Nullable(shelfMatchedUnitDTOSchema)),
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
  slug: t.Optional(t.Nullable(t.String())),
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

const shelfListCommonProperties = {
  ...listGetQueryBase.properties,
  userId: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  containsUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
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
};

const shelfListBodyCommonProperties = {
  ...listPostBodyBase.properties,
  userId: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  containsUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
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
};

export const shelfListQuerySchema = t.Object(shelfListCommonProperties);

export type ShelfListQuery = (typeof shelfListQuerySchema)["static"];

export const shelfListBodySchema = t.Object(shelfListBodyCommonProperties);

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
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
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
        description: t.Optional(t.Nullable(contentDocWriteSchema)),
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
  licenseSlug: t.Optional(t.Nullable(licenseSlugSchema)),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateShelfInput = (typeof updateShelfSchema)["static"];

// ============================================================
// SHELF PINNED TAGS
// ============================================================

export const setPinnedTagsBodySchema = t.Object({
  pinnedTagIds: t.Array(t.String({ format: "uuid" })),
});

export type SetPinnedTagsInput = (typeof setPinnedTagsBodySchema)["static"];

export const setPinnedTagsResponseSchema = t.Object({
  tags: t.Array(
    t.Object({
      tagUnitId: t.String(),
      score: t.Number(),
    }),
  ),
});

export type SetPinnedTagsResponse =
  (typeof setPinnedTagsResponseSchema)["static"];

// ============================================================
// SHELF ITEM CRUD
// ============================================================

export const addShelfItemSchema = t.Object({
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
  /**
   * Weak selected VARIANT context. The ShelfItem row remains keyed by
   * `(shelfId, itemType, itemId)` and this value is not validated as existing
   * or VARIANT.
   */
  variantUnitId: t.Optional(t.String()),
  kind: shelfItemKindSchema,
  parentItemType: t.Optional(t.Nullable(shelfItemTypeSchema)),
  parentItemId: t.Optional(t.Nullable(t.String())),
  parentRole: t.Optional(t.Nullable(shelfItemParentRoleSchema)),
  tagUnitIds: t.Optional(t.Array(t.String())),
  searchText: t.Optional(t.Nullable(t.String())),
});

export type AddShelfItemInput = (typeof addShelfItemSchema)["static"];

export const shelfItemParamsSchema = t.Object({
  shelfId: t.String(),
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
});

export type ShelfItemParams = (typeof shelfItemParamsSchema)["static"];

export const shelfItemsQuerySchema = t.Object({
  q: t.Optional(t.String()),
  itemType: t.Optional(shelfItemTypeSchema),
  variantUnitId: t.Optional(t.String()),
  tagUnitIds: t.Optional(t.Array(t.String())),
  cursor: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export type ShelfItemsQuery = (typeof shelfItemsQuerySchema)["static"];

export const shelfItemsResponseSchema = t.Object({
  items: t.Array(shelfItemDTOSchema),
  units: t.Optional(t.Array(shelfItemDTOSchema)),
  relations: t.Optional(t.Array(shelfItemChildDTOSchema)),
  hasMore: t.Boolean(),
});

export type ShelfItemsResponse = (typeof shelfItemsResponseSchema)["static"];

export const reorderShelfItemSchema = t.Object({
  beforeItemId: t.Optional(t.String()),
  afterItemId: t.Optional(t.String()),
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

export const setShelfItemChildrenSchema = t.Object({
  role: shelfItemParentRoleSchema,
  childItemType: t.Optional(shelfItemTypeSchema),
  childItemIds: t.Optional(t.Array(t.String(), { uniqueItems: true })),
});

export type SetShelfItemChildrenInput =
  (typeof setShelfItemChildrenSchema)["static"];

export const cleanupShelfOrphansSchema = t.Object({
  orphanItemIds: t.Array(t.String()),
});

export type CleanupShelfOrphansInput =
  (typeof cleanupShelfOrphansSchema)["static"];

// ============================================================
// SHELF ITEM BATCH OPS
// ============================================================

export const shelfItemBatchAddOpSchema = t.Object({
  op: t.Literal("add"),
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
  variantUnitId: t.Optional(t.String()),
  kind: shelfItemKindSchema,
  parentItemType: t.Optional(t.Nullable(shelfItemTypeSchema)),
  parentItemId: t.Optional(t.Nullable(t.String())),
  parentRole: t.Optional(t.Nullable(shelfItemParentRoleSchema)),
  position: t.String(),
});

export type ShelfItemBatchAddOp = (typeof shelfItemBatchAddOpSchema)["static"];

export const shelfItemBatchReorderOpSchema = t.Object({
  op: t.Literal("reorder"),
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
  position: t.String(),
});

export type ShelfItemBatchReorderOp =
  (typeof shelfItemBatchReorderOpSchema)["static"];

export const shelfItemBatchReorderToPageOpSchema = t.Object({
  op: t.Literal("reorderToPage"),
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
  toPage: t.Number(),
  edge: t.Literal("first"),
  pageSize: t.Optional(t.Number()),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export type ShelfItemBatchReorderToPageOp =
  (typeof shelfItemBatchReorderToPageOpSchema)["static"];

export const shelfItemBatchDeleteOpSchema = t.Object({
  op: t.Literal("delete"),
  itemType: shelfItemTypeSchema,
  itemId: t.String(),
});

export type ShelfItemBatchDeleteOp =
  (typeof shelfItemBatchDeleteOpSchema)["static"];

export const shelfItemBatchAttachOpSchema = t.Object({
  op: t.Literal("attach"),
  parentItemType: shelfItemTypeSchema,
  parentItemId: t.String(),
  childItemType: shelfItemTypeSchema,
  childItemId: t.String(),
  childVariantUnitId: t.Optional(t.String()),
  childKind: shelfItemKindSchema,
  role: shelfItemParentRoleSchema,
  position: t.Optional(t.String()),
});

export type ShelfItemBatchAttachOp =
  (typeof shelfItemBatchAttachOpSchema)["static"];

export const shelfItemBatchDetachOpSchema = t.Object({
  op: t.Literal("detach"),
  parentItemType: shelfItemTypeSchema,
  parentItemId: t.String(),
  childItemType: shelfItemTypeSchema,
  childItemId: t.String(),
  role: shelfItemParentRoleSchema,
});

export type ShelfItemBatchDetachOp =
  (typeof shelfItemBatchDetachOpSchema)["static"];

export const shelfItemBatchSetChildrenOpSchema = t.Object({
  op: t.Literal("setChildren"),
  parentItemType: shelfItemTypeSchema,
  parentItemId: t.String(),
  role: shelfItemParentRoleSchema,
  childItemType: shelfItemTypeSchema,
  childItemIds: t.Optional(t.Array(t.String(), { uniqueItems: true })),
  childKind: t.Optional(shelfItemKindSchema),
});

export type ShelfItemBatchSetChildrenOp =
  (typeof shelfItemBatchSetChildrenOpSchema)["static"];

export const shelfItemBatchOpSchema = t.Union([
  shelfItemBatchAddOpSchema,
  shelfItemBatchReorderOpSchema,
  shelfItemBatchReorderToPageOpSchema,
  shelfItemBatchDeleteOpSchema,
  shelfItemBatchAttachOpSchema,
  shelfItemBatchDetachOpSchema,
  shelfItemBatchSetChildrenOpSchema,
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
    unit: t.Optional(shelfItemDTOSchema),
    relation: t.Optional(shelfItemChildDTOSchema),
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
  variantUnitId: t.Optional(t.String()),
  shelfIds: t.Array(t.String()),
  independent: t.Optional(t.Boolean()),
  tagUnitIds: t.Optional(t.Array(t.String())),
  searchText: t.Optional(t.Nullable(t.String())),
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

export const collectionStatusBatchRequestSchema = t.Object({
  targetIds: t.Array(t.String()),
});

export type CollectionStatusBatchRequest =
  (typeof collectionStatusBatchRequestSchema)["static"];

export const collectionStatusBatchResponseSchema = t.Object({
  statusesByTarget: t.Record(t.String(), collectionStatusResponseSchema),
});

export type CollectionStatusBatchResponse =
  (typeof collectionStatusBatchResponseSchema)["static"];

// ============================================================
// USER UNIT COLLECTION METADATA
// ============================================================

export const userTagApplicationDTOSchema = t.Object(
  {
    userId: t.String(),
    unitId: t.String(),
    tagUnitId: t.String(),
    position: t.Optional(t.Nullable(t.String())),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);

export type UserTagApplicationDTO =
  (typeof userTagApplicationDTOSchema)["static"];

export const setUserTagApplicationsSchema = t.Object({
  unitId: t.String(),
  tagUnitIds: t.Array(t.String()),
});

export type SetUserTagApplicationsInput =
  (typeof setUserTagApplicationsSchema)["static"];

export const reorderUserTagApplicationSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
  beforeTagUnitId: t.Optional(t.String()),
  afterTagUnitId: t.Optional(t.String()),
});

export type ReorderUserTagApplicationInput =
  (typeof reorderUserTagApplicationSchema)["static"];

export const userUnitCollectionDTOSchema = t.Object({
  userId: t.String(),
  unitId: t.String(),
  searchText: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UserUnitCollectionDTO =
  (typeof userUnitCollectionDTOSchema)["static"];

export const patchUserUnitCollectionSchema = t.Object({
  unitId: t.String(),
  tagUnitIds: t.Optional(t.Array(t.String())),
  searchText: t.Optional(t.Nullable(t.String())),
});

export type PatchUserUnitCollectionInput =
  (typeof patchUserUnitCollectionSchema)["static"];

export const collectionSearchQuerySchema = t.Object({
  q: t.Optional(t.String()),
  tagUnitIds: t.Optional(t.Array(t.String())),
  userId: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export type CollectionSearchQuery =
  (typeof collectionSearchQuerySchema)["static"];

export const collectionUnitDTOSchema = t.Object({
  userId: t.String(),
  unitId: t.String(),
  shelfIds: t.Array(t.String()),
  tagUnitIds: t.Array(t.String()),
  searchText: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type CollectionUnitDTO = (typeof collectionUnitDTOSchema)["static"];

export const collectionSearchResponseSchema = t.Object({
  units: t.Array(collectionUnitDTOSchema),
  hasMore: t.Boolean(),
});

export type CollectionSearchResponse =
  (typeof collectionSearchResponseSchema)["static"];
