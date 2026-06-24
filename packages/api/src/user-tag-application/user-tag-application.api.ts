import type {
  ReorderUserTagApplicationInput,
  SetUserTagApplicationsInput,
  UserTagApplicationDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const userTagApplicationApi = {
  listForUnit: async (unitId: string): Promise<UserTagApplicationDTO[]> => {
    return apiFetch<UserTagApplicationDTO[]>(`/user-tag-application/${unitId}`);
  },

  setForUnit: async (
    unitId: string,
    input: Omit<SetUserTagApplicationsInput, "unitId">,
  ): Promise<UserTagApplicationDTO[]> => {
    return apiFetch<UserTagApplicationDTO[]>(
      `/user-tag-application/${unitId}`,
      {
        method: "PUT",
        body: JSON.stringify({ ...input, unitId }),
      },
    );
  },

  reorder: async (
    unitId: string,
    tagUnitId: string,
    input: Omit<ReorderUserTagApplicationInput, "unitId" | "tagUnitId">,
  ): Promise<UserTagApplicationDTO> => {
    return apiFetch<UserTagApplicationDTO>(
      `/user-tag-application/${unitId}/${tagUnitId}/position`,
      {
        method: "PATCH",
        body: JSON.stringify({ ...input, unitId, tagUnitId }),
      },
    );
  },

  deleteOne: async (
    unitId: string,
    tagUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/user-tag-application/${unitId}/${tagUnitId}`,
      { method: "DELETE" },
    );
  },
};
