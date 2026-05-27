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
};
