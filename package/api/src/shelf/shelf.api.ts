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
  ShelfItemDTO,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

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
  listItems: async (
    shelfUnitId: string,
    query?: ShelfItemsQuery,
  ): Promise<{ items: ShelfItemDTO[]; hasMore: boolean }> => {
    return apiFetch(`/shelf/${shelfUnitId}/items${buildQueryString(query)}`);
  },

  addItem: async (
    shelfUnitId: string,
    input: AddShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(`/shelf/${shelfUnitId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  reorderItem: async (
    shelfUnitId: string,
    itemRef: string,
    input: ReorderShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${shelfUnitId}/items/${itemRef}/position`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  removeItem: async (
    shelfUnitId: string,
    itemRef: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfUnitId}/items/${itemRef}`,
      { method: "DELETE" },
    );
  },

  attachReview: async (
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${shelfUnitId}/items/${itemRef}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({ reviewUnitId }),
      },
    );
  },

  detachReview: async (
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${shelfUnitId}/items/${itemRef}/reviews/${reviewUnitId}`,
      { method: "DELETE" },
    );
  },

  setItemTags: async (
    shelfUnitId: string,
    itemRef: string,
    input: SetShelfItemTagsInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${shelfUnitId}/items/${itemRef}/tags`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  cleanupOrphans: async (
    shelfUnitId: string,
    input: CleanupShelfOrphansInput,
  ): Promise<{ deleted: number }> => {
    return apiFetch<{ deleted: number }>(`/shelf/${shelfUnitId}/cleanup`, {
      method: "POST",
      body: JSON.stringify(input),
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
};
