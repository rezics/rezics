import type {
  CreditAttributionDTO,
  LinkCreditAttributionInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const creditAttributionApi = {
  listByUnit: async (unitId: string): Promise<CreditAttributionDTO[]> => {
    return apiFetch<CreditAttributionDTO[]>(
      `/credit-attribution/by-unit/${unitId}`,
    );
  },

  link: async (
    input: LinkCreditAttributionInput,
  ): Promise<CreditAttributionDTO> => {
    return apiFetch<CreditAttributionDTO>("/credit-attribution", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unlink: async (
    unitId: string,
    entityId: string,
    role: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/credit-attribution/${unitId}/${entityId}/${role}`,
      { method: "DELETE" },
    );
  },
};
