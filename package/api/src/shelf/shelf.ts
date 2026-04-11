// API Clients
export { collectionApi, shelfApi, userKeywordsApi } from "./shelf.api";

// Query Keys
export { collectionKeys, shelfKeys, userKeywordKeys } from "./shelf.keys";

// Mutation Hooks
export {
  collectionMutations,
  shelfMutations,
  useAddShelfItemMutation,
  useCollectMutation,
  useCreateShelfMutation,
  useDeleteShelfMutation,
  useDetachReviewMutation,
  useRemoveShelfItemMutation,
  useReorderShelfItemsMutation,
  useToggleFavoriteMutation,
  useUpdateKeywordsMutation,
  useUpdateShelfItemMutation,
  useUpdateShelfMutation,
  userKeywordMutations,
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
  userKeywordQueries,
  userKeywordsQuery,
  userShelvesQuery,
} from "./shelf.queries";

// Types
export type {
  AddShelfItemInput,
  CollectInput,
  CollectResponse,
  CollectionStatusResponse,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfFilters,
  ShelfFormData,
  ShelfItemDTO,
  ShelfItemReviewDTO,
  ShelfItemsQuery,
  ShelfListResponse,
  ShelfResponse,
  ShelfSortOption,
  ShelfSummaryDTO,
  ShelfView,
  ToggleFavoriteInput,
  ToggleFavoriteResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "./shelf.types";
