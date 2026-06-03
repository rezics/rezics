// API Clients
export { collectionApi, shelfApi } from "./shelf.api";

// Query Keys
export { collectionKeys, shelfKeys } from "./shelf.keys";

// Mutation Hooks
export {
  collectionMutations,
  shelfMutations,
  useAddShelfUnitMutation,
  useAttachReviewMutation,
  useBatchUpdateShelfUnitsMutation,
  useCleanupOrphansMutation,
  useCollectMutation,
  useCreateShelfMutation,
  useDeleteShelfMutation,
  useDetachReviewMutation,
  useRemoveShelfUnitMutation,
  useReorderShelfUnitMutation,
  useSetShelfUnitChildrenMutation,
  useToggleFavoriteMutation,
  useUpdateShelfMutation,
} from "./shelf.mutations";

// Query Configurations
export {
  collectionQueries,
  collectionStatusBatchQuery,
  collectionStatusQuery,
  shelfDetailQuery,
  shelfInfiniteListQuery,
  shelfListQuery,
  shelfQueries,
  shelfUnitsInfiniteQuery,
  shelfUnitsQuery,
  shelvesByUserQuery,
  shelvesByVariantContextQuery,
  useCollectionStatusHydration,
  userShelvesQuery,
} from "./shelf.queries";
// Types
export type {
  AddShelfUnitInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfUnitInput,
  SetShelfUnitChildrenInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfFilters,
  ShelfFormData,
  ShelfListResponse,
  ShelfResponse,
  ShelfSortField,
  ShelfSortOrder,
  ShelfSortState,
  ShelfSummaryDTO,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
  ShelfUnitsQuery,
  ShelfUnitsResponse,
  ShelfView,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "./shelf.types";
export type {
  EnrichedShelfUnit,
  HydratedShelfUnitsResult,
  ShelfHydrationResult,
  ShelfPrimaryDTO,
  TagListEntryDTO,
} from "./useShelfHydration";
// Hydration hook
export {
  useHydratedShelfUnits,
  useShelfHydration,
} from "./useShelfHydration";
