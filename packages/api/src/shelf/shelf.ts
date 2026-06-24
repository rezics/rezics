// API Clients
// API 客户端。
export { shelfItemActionApi, shelfApi } from "./shelf.api";

// Query Keys
// 查询键。
export { shelfItemStatusKeys, shelfKeys } from "./shelf.keys";

// Mutation Hooks
// 变更 Hooks。
export {
  shelfItemActionMutations,
  shelfMutations,
  useAddToShelvesMutation,
  useAddShelfItemMutation,
  useAttachReviewMutation,
  useBatchUpdateShelfItemsMutation,
  useCleanupOrphansMutation,
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
// 查询配置。
export {
  shelfDetailQuery,
  shelfItemStatusBatchQuery,
  shelfItemStatusQueries,
  shelfItemStatusQuery,
  shelfInfiniteListQuery,
  shelfItemsInfiniteQuery,
  shelfItemsQuery,
  shelfListQuery,
  shelfQueries,
  shelvesByUserQuery,
  shelvesByVariantContextQuery,
  useShelfItemStatusHydration,
  userShelvesInfiniteQuery,
  userShelvesQuery,
} from "./shelf.queries";
// Types
// 类型。
export type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  AddToShelvesInput,
  ShelfItemStatusBatchResponse,
  ShelfItemStatusResponse,
  AddToShelvesResponse,
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
// 水合 Hook。
export {
  useHydratedShelfItems,
  useShelfHydration,
} from "./useShelfHydration";
