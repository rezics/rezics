import type {
  CreditAttributionDTO,
  CreditAttributionRole,
  CreateCreditAttributionEvidenceInput,
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

  createEvidence: async (
    input: CreateCreditAttributionEvidenceInput,
  ): Promise<CreditAttributionDTO> => {
    return apiFetch<CreditAttributionDTO>("/credit-attribution/evidence", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  unlink: async (
    unitId: string,
    entityId: string,
    role: CreditAttributionRole,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/credit-attribution/${unitId}/${entityId}/${role}`,
      { method: "DELETE" },
    );
  },
};
