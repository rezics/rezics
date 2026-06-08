import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Shelf Item Search Document
// ANCHOR: 书架条目搜索文档

export const ShelfItemSearchDocumentSchema = t.Object({
  id: t.String(),
  shelfId: t.String(),
  shelfOwnerUserId: t.String(),
  shelfVisibility: t.String(),
  shelfStatus: t.String(),
  shelfTitle: t.Union([t.String(), t.Null()]),

  itemType: t.String(),
  itemId: t.String(),
  kind: t.String(),
  rootItemType: t.String(),
  rootItemId: t.String(),
  parentItemType: t.Union([t.String(), t.Null()]),
  parentItemId: t.Union([t.String(), t.Null()]),
  parentRole: t.Union([t.String(), t.Null()]),
  position: t.String(),

  itemTitle: t.Union([t.String(), t.Null()]),
  itemSummary: t.Union([t.String(), t.Null()]),
  itemText: t.Union([t.String(), t.Null()]),
  searchText: t.Union([t.String(), t.Null()]),

  rootUnitId: t.Union([t.String(), t.Null()]),
  realmUnitId: t.Union([t.String(), t.Null()]),
  parentCommentId: t.Union([t.String(), t.Null()]),
  authorUserId: t.Union([t.String(), t.Null()]),
  authorName: t.Union([t.String(), t.Null()]),
  moderationStatus: t.Union([t.String(), t.Null()]),
  isLocked: t.Union([t.Boolean(), t.Null()]),
  deletedAt: t.Union([t.String(), t.Null()]),

  createdAt: t.Number(),
  updatedAt: t.Number(),
});

export type ShelfItemSearchDocument = Static<
  typeof ShelfItemSearchDocumentSchema
>;

// ANCHOR: Shelf Item Search Options
// ANCHOR: 书架条目搜索选项

export const ShelfItemSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  shelfId: t.Optional(t.String()),
  shelfIds: t.Optional(t.Array(t.String())),
  shelfOwnerUserId: t.Optional(t.String()),
  shelfVisibility: t.Optional(t.String()),
  shelfStatus: t.Optional(t.String()),
  itemType: t.Optional(t.String()),
  itemId: t.Optional(t.String()),
  kind: t.Optional(t.String()),
  rootItemId: t.Optional(t.String()),
  parentItemId: t.Optional(t.Nullable(t.String())),
  parentRole: t.Optional(t.Nullable(t.String())),
  includePrivateSearchText: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("position"),
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type ShelfItemSearchOptions = Static<
  typeof ShelfItemSearchOptionsSchema
>;

// ANCHOR: Shelf Item Search Result
// ANCHOR: 书架条目搜索结果

export const ShelfItemMatchSchema = t.Object({
  item: ShelfItemSearchDocumentSchema,
  score: t.Optional(t.Number()),
});

export type ShelfItemMatch = Static<typeof ShelfItemMatchSchema>;

export const ShelfItemShelfGroupSchema = t.Object({
  shelfId: t.String(),
  shelfTitle: t.Union([t.String(), t.Null()]),
  shelfOwnerUserId: t.String(),
  shelfVisibility: t.String(),
  total: t.Number(),
  matches: t.Array(ShelfItemMatchSchema),
});

export type ShelfItemShelfGroup = Static<typeof ShelfItemShelfGroupSchema>;

export const ShelfItemSearchResultSchema = t.Object({
  items: t.Array(ShelfItemSearchDocumentSchema),
  groups: t.Optional(t.Array(ShelfItemShelfGroupSchema)),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type ShelfItemSearchResult = Static<typeof ShelfItemSearchResultSchema>;
