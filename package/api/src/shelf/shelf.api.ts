import type {
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
  ShelfListResponse,
  ShelfResponse,
  ShelfSummaryDTO,
  ShelfUnitBatchOp,
  ShelfUnitBatchResponse,
  ShelfUnitDTO,
  ShelfUnitRelationDTO,
  ShelfUnitsResponse,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { ShelfFilters, ShelfUnitsQuery } from "./shelf.types";

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

  // Shelf units
  listUnits: async (
    shelfId: string,
    query?: ShelfUnitsQuery,
  ): Promise<ShelfUnitsResponse> => {
    return apiFetch(`/shelf/${shelfId}/units${buildQueryString(query)}`);
  },

  addUnit: async (
    shelfId: string,
    input: AddShelfUnitInput,
  ): Promise<ShelfUnitDTO> => {
    return apiFetch<ShelfUnitDTO>(`/shelf/${shelfId}/units`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  reorderUnit: async (
    shelfId: string,
    shelfUnitId: string,
    input: ReorderShelfUnitInput,
  ): Promise<ShelfUnitDTO> => {
    return apiFetch<ShelfUnitDTO>(
      `/shelf/${shelfId}/units/${shelfUnitId}/position`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  removeUnit: async (
    shelfId: string,
    shelfUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfId}/units/${shelfUnitId}`,
      { method: "DELETE" },
    );
  },

  attachReview: async (
    shelfId: string,
    shelfUnitId: string,
    reviewUnitId: string,
  ): Promise<ShelfUnitRelationDTO> => {
    return apiFetch<ShelfUnitRelationDTO>(
      `/shelf/${shelfId}/units/${shelfUnitId}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({ reviewUnitId }),
      },
    );
  },

  detachReview: async (
    shelfId: string,
    shelfUnitId: string,
    reviewUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfId}/units/${shelfUnitId}/reviews/${reviewUnitId}`,
      { method: "DELETE" },
    );
  },

  setChildren: async (
    shelfId: string,
    shelfUnitId: string,
    input: SetShelfUnitChildrenInput,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/shelf/${shelfId}/units/${shelfUnitId}/children`,
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

  batchUpdateUnits: async (
    shelfId: string,
    ops: ShelfUnitBatchOp[],
  ): Promise<ShelfUnitBatchResponse> => {
    return apiFetch<ShelfUnitBatchResponse>(`/shelf/${shelfId}/units/batch`, {
      method: "PATCH",
      body: JSON.stringify({ ops }),
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
