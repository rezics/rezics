// API Clients
export { collectionApi, shelfApi } from "./shelf.api";

// Query Keys
export { collectionKeys, shelfKeys } from "./shelf.keys";

// Mutation Hooks
export {
  collectionMutations,
  shelfMutations,
  useAddShelfItemMutation,
  useAttachReviewMutation,
  useBatchUpdateShelfItemsMutation,
  useCleanupOrphansMutation,
  useCollectMutation,
  useCreateShelfMutation,
  useDeleteShelfMutation,
  useDetachReviewMutation,
  useRemoveShelfItemMutation,
  useReorderShelfItemMutation,
  useSetShelfItemChildrenMutation,
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
  shelfItemsInfiniteQuery,
  shelfItemsQuery,
  shelfListQuery,
  shelfQueries,
  shelvesByUserQuery,
  shelvesByVariantContextQuery,
  useCollectionStatusHydration,
  userShelvesQuery,
} from "./shelf.queries";
// Types
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
  ShelfFilters,
  ShelfFormData,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemsQuery,
  ShelfItemsResponse,
  ShelfItemType,
  ShelfListResponse,
  ShelfResponse,
  ShelfSortField,
  ShelfSortOrder,
  ShelfSortState,
  ShelfSummaryDTO,
  ShelfView,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "./shelf.types";
export type {
  EnrichedShelfItem,
  HydratedShelfItemsResult,
  ShelfHydrationResult,
  ShelfPrimaryDTO,
  TagListEntryDTO,
} from "./useShelfHydration";
// Hydration hook
export {
  useHydratedShelfItems,
  useShelfHydration,
} from "./useShelfHydration";
