import type {
  PatchUserUnitCollectionInput,
  UserUnitCollectionDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

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
};
