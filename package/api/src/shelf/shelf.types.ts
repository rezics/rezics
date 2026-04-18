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
  UpdateShelfItemInput,
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
  UpdateShelfItemInput,
};

export type ShelfFormData = CreateShelfInput;
export type ShelfFilters = Partial<ShelfListQuery>;
export type ShelfView = "grid" | "list" | "review";

export type ShelfSortMode = "manual" | "time" | "title";
