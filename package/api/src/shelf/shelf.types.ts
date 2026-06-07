import type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetShelfItemChildrenInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemsQuery,
  ShelfItemsResponse,
  ShelfItemType,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";

export type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetShelfItemChildrenInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemsQuery,
  ShelfItemsResponse,
  ShelfItemType,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
};

export type ShelfFormData = CreateShelfInput;
export type ShelfFilters = Partial<ShelfListQuery>;
export type ShelfView = "nested" | "flat" | "masonry" | "bookshelf";

export type ShelfSortField = "manual" | "addedAt" | "title";
export type ShelfSortOrder = "asc" | "desc";
export type ShelfSortState = {
  field: ShelfSortField;
  order: ShelfSortOrder;
};
