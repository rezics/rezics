import type {
  AddShelfItemInput,
  CollectInput,
  CollectResponse,
  CollectionStatusResponse,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemReviewDTO,
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
  CollectInput,
  CollectResponse,
  CollectionStatusResponse,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemReviewDTO,
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
export type ShelfSortOption = "createdAt" | "updatedAt";
export type ShelfView = "grid" | "list" | "review";
