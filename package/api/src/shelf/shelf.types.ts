import type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetShelfItemTagsInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemsQuery,
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
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetShelfItemTagsInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemsQuery,
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
export type ShelfView = "nested" | "flat" | "masonry";

export type ShelfSortField = "manual" | "addedAt" | "title";
export type ShelfSortOrder = "asc" | "desc";
export type ShelfSortState = {
  field: ShelfSortField;
  order: ShelfSortOrder;
};
