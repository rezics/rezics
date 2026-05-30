import { t } from "elysia";
import { contentDocWriteSchema } from "./content-doc-v1";
import { languageSchema } from "./language";
import { licenseSlugSchema } from "./license";
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

export const shelfCoverImageSpec = {
  aspectRatio: "16 / 9",
  width: 16,
  height: 9,
} as const;

// ============================================================
// SHELF UNIT KIND
// ============================================================

export const shelfUnitKindSchema = t.Union([
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

export type ShelfUnitKind = (typeof shelfUnitKindSchema)["static"];

// ============================================================
// SHELF UNIT RELATION ROLE
// ============================================================

export const shelfUnitRelationRoleSchema = t.Union([
  t.Literal("review"),
  t.Literal("tag"),
]);

export type ShelfUnitRelationRole =
  (typeof shelfUnitRelationRoleSchema)["static"];

// ============================================================
// SHELF UNIT DTO
// ============================================================

export const shelfUnitDTOSchema = t.Object({
  shelfId: t.String(),
  unitId: t.String(),
  kind: shelfUnitKindSchema,
  position: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ShelfUnitDTO = (typeof shelfUnitDTOSchema)["static"];

// ============================================================
// SHELF UNIT RELATION DTO
// ============================================================

export const shelfUnitRelationDTOSchema = t.Object({
  shelfId: t.String(),
  parentUnitId: t.String(),
  childUnitId: t.String(),
  role: shelfUnitRelationRoleSchema,
});

export type ShelfUnitRelationDTO =
  (typeof shelfUnitRelationDTOSchema)["static"];

export const shelfMatchedUnitDTOSchema = t.Object({
  unitId: t.String(),
  kind: shelfUnitKindSchema,
  title: t.Optional(t.Nullable(t.String())),
  workUnitId: t.Optional(t.Nullable(t.String())),
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
  itemCount: t.Optional(t.Number()),
  matchedUnit: t.Optional(t.Nullable(shelfMatchedUnitDTOSchema)),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  units: t.Optional(t.Array(shelfUnitDTOSchema)),
  relations: t.Optional(t.Array(shelfUnitRelationDTOSchema)),
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
  containsWorkUnitId: t.Optional(t.String()),
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
  containsWorkUnitId: t.Optional(t.String()),
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

export function hasAmbiguousShelfListScopeFilters(
  value: Pick<ShelfListQuery, "containsUnitId" | "containsWorkUnitId">,
): boolean {
  return Boolean(
    value.containsUnitId?.trim() && value.containsWorkUnitId?.trim(),
  );
}

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
// SHELF UNIT CRUD
// ============================================================

export const addShelfUnitSchema = t.Object({
  unitId: t.String(),
  kind: shelfUnitKindSchema,
});

export type AddShelfUnitInput = (typeof addShelfUnitSchema)["static"];

export const shelfUnitParamsSchema = t.Object({
  shelfId: t.String(),
  unitId: t.String(),
});

export type ShelfUnitParams = (typeof shelfUnitParamsSchema)["static"];

export const shelfUnitsQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export type ShelfUnitsQuery = (typeof shelfUnitsQuerySchema)["static"];

export const shelfUnitsResponseSchema = t.Object({
  units: t.Array(shelfUnitDTOSchema),
  relations: t.Array(shelfUnitRelationDTOSchema),
  hasMore: t.Boolean(),
});

export type ShelfUnitsResponse = (typeof shelfUnitsResponseSchema)["static"];

export const reorderShelfUnitSchema = t.Object({
  beforeUnitId: t.Optional(t.String()),
  afterUnitId: t.Optional(t.String()),
});

export type ReorderShelfUnitInput = (typeof reorderShelfUnitSchema)["static"];

export const attachReviewSchema = t.Object({
  reviewUnitId: t.String(),
});

export type AttachReviewInput = (typeof attachReviewSchema)["static"];

export const detachReviewSchema = t.Object({
  reviewUnitId: t.String(),
});

export type DetachReviewInput = (typeof detachReviewSchema)["static"];

export const setShelfUnitChildrenSchema = t.Object({
  role: shelfUnitRelationRoleSchema,
  childUnitIds: t.Array(t.String()),
});

export type SetShelfUnitChildrenInput =
  (typeof setShelfUnitChildrenSchema)["static"];

export const cleanupShelfOrphansSchema = t.Object({
  orphanUnitIds: t.Array(t.String()),
});

export type CleanupShelfOrphansInput =
  (typeof cleanupShelfOrphansSchema)["static"];

// ============================================================
// SHELF UNIT BATCH OPS
// ============================================================

export const shelfUnitBatchAddOpSchema = t.Object({
  op: t.Literal("add"),
  unitId: t.String(),
  kind: shelfUnitKindSchema,
  position: t.String(),
});

export type ShelfUnitBatchAddOp = (typeof shelfUnitBatchAddOpSchema)["static"];

export const shelfUnitBatchReorderOpSchema = t.Object({
  op: t.Literal("reorder"),
  unitId: t.String(),
  position: t.String(),
});

export type ShelfUnitBatchReorderOp =
  (typeof shelfUnitBatchReorderOpSchema)["static"];

export const shelfUnitBatchReorderToPageOpSchema = t.Object({
  op: t.Literal("reorderToPage"),
  unitId: t.String(),
  toPage: t.Number(),
  edge: t.Literal("first"),
  pageSize: t.Optional(t.Number()),
  order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
});

export type ShelfUnitBatchReorderToPageOp =
  (typeof shelfUnitBatchReorderToPageOpSchema)["static"];

export const shelfUnitBatchDeleteOpSchema = t.Object({
  op: t.Literal("delete"),
  unitId: t.String(),
});

export type ShelfUnitBatchDeleteOp =
  (typeof shelfUnitBatchDeleteOpSchema)["static"];

export const shelfUnitBatchAttachOpSchema = t.Object({
  op: t.Literal("attach"),
  parentUnitId: t.String(),
  childUnitId: t.String(),
  childKind: shelfUnitKindSchema,
  role: shelfUnitRelationRoleSchema,
  position: t.Optional(t.String()),
});

export type ShelfUnitBatchAttachOp =
  (typeof shelfUnitBatchAttachOpSchema)["static"];

export const shelfUnitBatchDetachOpSchema = t.Object({
  op: t.Literal("detach"),
  parentUnitId: t.String(),
  childUnitId: t.String(),
  role: shelfUnitRelationRoleSchema,
});

export type ShelfUnitBatchDetachOp =
  (typeof shelfUnitBatchDetachOpSchema)["static"];

export const shelfUnitBatchSetChildrenOpSchema = t.Object({
  op: t.Literal("setChildren"),
  parentUnitId: t.String(),
  role: shelfUnitRelationRoleSchema,
  childUnitIds: t.Array(t.String()),
  childKind: t.Optional(shelfUnitKindSchema),
});

export type ShelfUnitBatchSetChildrenOp =
  (typeof shelfUnitBatchSetChildrenOpSchema)["static"];

export const shelfUnitBatchOpSchema = t.Union([
  shelfUnitBatchAddOpSchema,
  shelfUnitBatchReorderOpSchema,
  shelfUnitBatchReorderToPageOpSchema,
  shelfUnitBatchDeleteOpSchema,
  shelfUnitBatchAttachOpSchema,
  shelfUnitBatchDetachOpSchema,
  shelfUnitBatchSetChildrenOpSchema,
]);

export type ShelfUnitBatchOp = (typeof shelfUnitBatchOpSchema)["static"];

export const shelfUnitBatchRequestSchema = t.Object({
  ops: t.Array(shelfUnitBatchOpSchema),
  baseVersion: t.Optional(t.String()),
});

export type ShelfUnitBatchRequest =
  (typeof shelfUnitBatchRequestSchema)["static"];

export const shelfUnitBatchResultSchema = t.Union([
  t.Object({
    status: t.Literal("ok"),
    op: shelfUnitBatchOpSchema,
    unit: t.Optional(shelfUnitDTOSchema),
    relation: t.Optional(shelfUnitRelationDTOSchema),
  }),
  t.Object({
    status: t.Literal("failed"),
    op: shelfUnitBatchOpSchema,
    reason: t.String(),
  }),
]);

export type ShelfUnitBatchResult =
  (typeof shelfUnitBatchResultSchema)["static"];

export const shelfUnitBatchResponseSchema = t.Object({
  results: t.Array(shelfUnitBatchResultSchema),
});

export type ShelfUnitBatchResponse =
  (typeof shelfUnitBatchResponseSchema)["static"];

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
