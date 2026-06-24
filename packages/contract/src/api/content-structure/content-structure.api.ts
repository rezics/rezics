import type {
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const contentStructureApi = {
  get: async (ownerUnitId: string): Promise<ContentStructureResponse> => {
    return apiFetch<ContentStructureResponse>(
      `/content-structure/${ownerUnitId}`,
    );
  },

  update: async (
    ownerUnitId: string,
    nodes: ContentStructureItem[],
  ): Promise<ContentStructureResponse> => {
    return apiFetch<ContentStructureResponse>(
      `/content-structure/${ownerUnitId}`,
      {
        method: "PUT",
        body: JSON.stringify(nodes),
      },
    );
  },

  restore: async (
    ownerUnitId: string,
    nodeIds: string[],
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/content-structure/${ownerUnitId}/restore`,
      {
        method: "POST",
        body: JSON.stringify({ nodeIds }),
      },
    );
  },
};
