import type {
  AddShelfUnitInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfUnitInput,
  SetShelfUnitChildrenInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
  ShelfUnitsQuery,
  ShelfUnitsResponse,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";

export type {
  AddShelfUnitInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfUnitInput,
  SetShelfUnitChildrenInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfListQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
  ShelfUnitsQuery,
  ShelfUnitsResponse,
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
