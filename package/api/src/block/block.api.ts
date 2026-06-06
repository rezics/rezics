/**
 * User-to-user block API client functions.
 */

import type { BlockListResponse, CreateBlock } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const blockApi = {
  list: async (): Promise<BlockListResponse> => {
    return apiFetch(`/block/list`);
  },

  add: async (input: CreateBlock): Promise<{ success: boolean }> => {
    return apiFetch(`/block`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  remove: async (userId: string): Promise<{ success: boolean }> => {
    return apiFetch(`/block/${userId}`, { method: "DELETE" });
  },
};
