import type {
  CreateGameSystemRequirementInput,
  GameSystemRequirementDTO,
  GameSystemRequirementListFilters,
  GameSystemRequirementListResponse,
  UpdateGameSystemRequirementInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const gameSystemRequirementApi = {
  list: async (
    filters?: GameSystemRequirementListFilters,
  ): Promise<GameSystemRequirementListResponse> => {
    return apiFetch<GameSystemRequirementListResponse>(
      `/game-system-requirement${buildQueryString(filters)}`,
    );
  },

  get: async (id: string): Promise<GameSystemRequirementDTO> => {
    return apiFetch<GameSystemRequirementDTO>(`/game-system-requirement/${id}`);
  },

  create: async (
    input: CreateGameSystemRequirementInput,
  ): Promise<GameSystemRequirementDTO> => {
    return apiFetch<GameSystemRequirementDTO>("/game-system-requirement", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    id: string,
    input: UpdateGameSystemRequirementInput,
  ): Promise<GameSystemRequirementDTO> => {
    return apiFetch<GameSystemRequirementDTO>(
      `/game-system-requirement/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  remove: async (id: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/game-system-requirement/${id}`, {
      method: "DELETE",
    });
  },
};
