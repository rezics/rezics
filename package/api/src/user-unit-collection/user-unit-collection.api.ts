import type {
  CollectionSearchQuery,
  CollectionSearchResponse,
  PatchUserUnitCollectionInput,
  UserUnitCollectionDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

function collectionSearchParams(query: CollectionSearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const tagUnitId of query.tagUnitIds ?? []) {
    params.append("tagUnitIds", tagUnitId);
  }
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const userUnitCollectionApi = {
  getForUnit: async (unitId: string): Promise<UserUnitCollectionDTO | null> => {
    return apiFetch<UserUnitCollectionDTO | null>(
      `/user-unit-collection/${unitId}`,
    );
  },

  patchForUnit: async (
    unitId: string,
    input: Omit<PatchUserUnitCollectionInput, "unitId">,
  ): Promise<UserUnitCollectionDTO | null> => {
    return apiFetch<UserUnitCollectionDTO | null>(
      `/user-unit-collection/${unitId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...input, unitId }),
      },
    );
  },

  searchMine: async (
    query: CollectionSearchQuery = {},
  ): Promise<CollectionSearchResponse> => {
    return apiFetch<CollectionSearchResponse>(
      `/user-unit-collection/search/me${collectionSearchParams(query)}`,
    );
  },

  searchUser: async (
    userId: string,
    query: Omit<CollectionSearchQuery, "userId"> = {},
  ): Promise<CollectionSearchResponse> => {
    return apiFetch<CollectionSearchResponse>(
      `/user-unit-collection/search/user/${userId}${collectionSearchParams(query)}`,
    );
  },
};
