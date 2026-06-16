import type {
  UserShelfItemsSearchQuery,
  UserShelfItemsSearchResponse,
  PatchUserShelfItemMetadataInput,
  UserShelfItemMetadataDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

function userShelfItemsSearchParams(query: UserShelfItemsSearchQuery): string {
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

export const userShelfItemApi = {
  getForUnit: async (
    unitId: string,
  ): Promise<UserShelfItemMetadataDTO | null> => {
    return apiFetch<UserShelfItemMetadataDTO | null>(
      `/shelf/item/metadata/${unitId}`,
    );
  },

  patchForUnit: async (
    unitId: string,
    input: Omit<PatchUserShelfItemMetadataInput, "unitId">,
  ): Promise<UserShelfItemMetadataDTO | null> => {
    return apiFetch<UserShelfItemMetadataDTO | null>(
      `/shelf/item/metadata/${unitId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...input, unitId }),
      },
    );
  },

  searchMine: async (
    query: UserShelfItemsSearchQuery = {},
  ): Promise<UserShelfItemsSearchResponse> => {
    return apiFetch<UserShelfItemsSearchResponse>(
      `/shelf/item/search/me${userShelfItemsSearchParams(query)}`,
    );
  },

  searchUser: async (
    userId: string,
    query: Omit<UserShelfItemsSearchQuery, "userId"> = {},
  ): Promise<UserShelfItemsSearchResponse> => {
    return apiFetch<UserShelfItemsSearchResponse>(
      `/shelf/item/search/user/${userId}${userShelfItemsSearchParams(query)}`,
    );
  },
};
