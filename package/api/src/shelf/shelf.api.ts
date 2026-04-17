import type {
  AddShelfItemInput,
  CollectInput,
  CollectResponse,
  CollectionStatusResponse,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfDetailDTO,
  ShelfItemDTO,
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ToggleFavoriteResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ShelfFilters, ShelfItemsQuery } from "./shelf.types";

export const shelfApi = {
  list: async (filters?: ShelfFilters): Promise<ShelfListResponse> => {
    return apiFetch<ShelfListResponse>(`/shelf/list${buildQueryString(filters)}`);
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
    return apiFetch(
      `/shelf/${shelfUnitId}/items${buildQueryString(query)}`,
    );
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

  updateItem: async (
    shelfUnitId: string,
    itemUnitId: string,
    input: UpdateShelfItemInput,
  ): Promise<ShelfItemDTO> => {
    return apiFetch<ShelfItemDTO>(
      `/shelf/${shelfUnitId}/items/${itemUnitId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  reorderItems: async (
    shelfUnitId: string,
    input: ReorderShelfItemsInput,
  ): Promise<{ message: string }> => {
    return apiFetch(`/shelf/${shelfUnitId}/items/reorder`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  removeItem: async (
    shelfUnitId: string,
    itemUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfUnitId}/items/${itemUnitId}`,
      { method: "DELETE" },
    );
  },

  detachReview: async (
    shelfUnitId: string,
    itemUnitId: string,
    reviewUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfUnitId}/items/${itemUnitId}/reviews/${reviewUnitId}`,
      { method: "DELETE" },
    );
  },
};

export const collectionApi = {
  collect: async (input: CollectInput): Promise<CollectResponse> => {
    return apiFetch<CollectResponse>("/collect", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  toggleFavorite: async (
    targetId: string,
  ): Promise<ToggleFavoriteResponse> => {
    return apiFetch<ToggleFavoriteResponse>("/collect/toggle-favorite", {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
  },

  status: async (targetId: string): Promise<CollectionStatusResponse> => {
    return apiFetch<CollectionStatusResponse>(
      `/collect/status/${targetId}`,
    );
  },
};

export const userKeywordsApi = {
  get: async (): Promise<string[]> => {
    return apiFetch<string[]>("/user/me/keywords");
  },

  update: async (input: {
    add?: string[];
    remove?: string[];
  }): Promise<string[]> => {
    return apiFetch<string[]>("/user/me/keywords", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};
