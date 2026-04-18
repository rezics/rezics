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
  useCleanupOrphansMutation,
  useCollectMutation,
  useCreateShelfMutation,
  useDeleteShelfMutation,
  useDetachReviewMutation,
  useRemoveShelfItemMutation,
  useReorderShelfItemMutation,
  useSetShelfItemTagsMutation,
  useToggleFavoriteMutation,
  useUpdateShelfItemMutation,
  useUpdateShelfMutation,
} from "./shelf.mutations";

// Query Configurations
export {
  collectionQueries,
  collectionStatusQuery,
  shelfDetailQuery,
  shelfInfiniteListQuery,
  shelfItemsQuery,
  shelfListQuery,
  shelfQueries,
  shelvesByUserQuery,
  userShelvesQuery,
} from "./shelf.queries";
// Types
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
  ShelfFilters,
  ShelfFormData,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemsQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSortMode,
  ShelfSummaryDTO,
  ShelfView,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "./shelf.types";
export type { ShelfHydrationResult } from "./useShelfHydration";
// Hydration hook
export { useShelfHydration } from "./useShelfHydration";
