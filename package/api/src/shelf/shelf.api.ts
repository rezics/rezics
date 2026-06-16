import type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  CreateShelfInput,
  EnsureSystemShelfResponse,
  ReorderShelfItemInput,
  SetPinnedTagsInput,
  SetPinnedTagsResponse,
  SetShelfItemChildrenInput,
  ShelfDetailDTO,
  ShelfItemBatchOp,
  ShelfItemBatchResponse,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemsResponse,
  ShelfItemType,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  SystemShelfKindKey,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

const encodePathPart = (value: string) => encodeURIComponent(value);

export const shelfApi = {
  list: async (filters?: ShelfFilters): Promise<ShelfListResponse> => {
    return apiFetch<ShelfListResponse>(
      `/shelf/list${buildQueryString(filters)}`,
    );
  },

  get: async (unitId: string): Promise<ShelfDetailDTO> => {
    return apiFetch<ShelfDetailDTO>(`/shelf/${unitId}`);
  },

  getByUserId: async (
    userId: string,
    filters?: ShelfFilters,
  ): Promise<ShelfListResponse> => {
    return apiFetch<ShelfListResponse>(
      `/shelf/list${buildQueryString({ userId, ...filters })}`,
    );
  },

  mine: async (): Promise<ShelfSummaryDTO[]> => {
    return apiFetch<ShelfSummaryDTO[]>("/shelf/me");
  },

  create: async (input: CreateShelfInput): Promise<ShelfResponse> => {
    return apiFetch<ShelfResponse>("/shelf", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    unitId: string,
    input: UpdateShelfInput,
  ): Promise<ShelfResponse> => {
    return apiFetch<ShelfResponse>(`/shelf/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/shelf/${unitId}`, {
      method: "DELETE",
    });
  },

  // Shelf items
  // 货架条目
  listItems: async (
    shelfId: string,
    query?: ShelfItemsQuery,
  ): Promise<ShelfItemsResponse> => {
    return apiFetch(`/shelf/${shelfId}/items${buildQueryString(query)}`);
  },

  addItem: async (
    shelfId: string,
    input: AddShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(`/shelf/${shelfId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  reorderItem: async (
    shelfId: string,
    itemType: ShelfItemType,
    itemId: string,
    input: ReorderShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${encodePathPart(shelfId)}/items/${encodePathPart(itemType)}/${encodePathPart(itemId)}/position`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  removeItem: async (
    shelfId: string,
    itemType: ShelfItemType,
    itemId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${encodePathPart(shelfId)}/items/${encodePathPart(itemType)}/${encodePathPart(itemId)}`,
      {
        method: "DELETE",
      },
    );
  },

  attachReview: async (
    shelfId: string,
    itemType: ShelfItemType,
    itemId: string,
    reviewUnitId: string,
  ): Promise<ShelfItemChildDTO> => {
    return apiFetch<ShelfItemChildDTO>(
      `/shelf/${encodePathPart(shelfId)}/items/${encodePathPart(itemType)}/${encodePathPart(itemId)}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({ reviewUnitId }),
      },
    );
  },

  detachReview: async (
    shelfId: string,
    itemType: ShelfItemType,
    itemId: string,
    reviewUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${encodePathPart(shelfId)}/items/${encodePathPart(itemType)}/${encodePathPart(itemId)}/reviews/${encodePathPart(reviewUnitId)}`,
      { method: "DELETE" },
    );
  },

  setChildren: async (
    shelfId: string,
    itemType: ShelfItemType,
    itemId: string,
    input: SetShelfItemChildrenInput,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${encodePathPart(shelfId)}/items/${encodePathPart(itemType)}/${encodePathPart(itemId)}/children`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  cleanupOrphans: async (
    shelfId: string,
    input: CleanupShelfOrphansInput,
  ): Promise<{ deleted: number }> => {
    return apiFetch<{ deleted: number }>(`/shelf/${shelfId}/cleanup`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  batchUpdateItems: async (
    shelfId: string,
    ops: ShelfItemBatchOp[],
  ): Promise<ShelfItemBatchResponse> => {
    return apiFetch<ShelfItemBatchResponse>(`/shelf/${shelfId}/items/batch`, {
      method: "PATCH",
      body: JSON.stringify({ ops }),
    });
  },

  setPinnedTags: async (
    shelfId: string,
    input: SetPinnedTagsInput,
  ): Promise<SetPinnedTagsResponse> => {
    return apiFetch<SetPinnedTagsResponse>(`/shelf/${shelfId}/pinned-tags`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  ensureSystem: async (
    kindKey: SystemShelfKindKey,
  ): Promise<EnsureSystemShelfResponse> => {
    return apiFetch<EnsureSystemShelfResponse>("/shelf/system/ensure", {
      method: "POST",
      body: JSON.stringify({ kindKey }),
    });
  },
};

export const collectionApi = {
  collect: async (input: CollectInput): Promise<CollectResponse> => {
    return apiFetch<CollectResponse>("/collect", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleFavorite: async (targetId: string): Promise<ToggleFavoriteResponse> => {
    return apiFetch<ToggleFavoriteResponse>("/collect/toggle-favorite", {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
  },

  status: async (targetId: string): Promise<CollectionStatusResponse> => {
    return apiFetch<CollectionStatusResponse>(`/collect/status/${targetId}`);
  },

  statusBatch: async (
    targetIds: string[],
  ): Promise<CollectionStatusBatchResponse> => {
    return apiFetch<CollectionStatusBatchResponse>("/collect/status/batch", {
      method: "POST",
      body: JSON.stringify({ targetIds }),
    });
  },
};
