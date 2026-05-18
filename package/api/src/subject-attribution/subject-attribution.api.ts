import type {
  LinkSubjectAttributionInput,
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
  SubjectAttributionDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const subjectAttributionApi = {
  listByUnit: async (
    unitId: string,
    query?: SubjectAttributionByUnitQuery,
  ): Promise<SubjectAttributionDTO[]> => {
    return apiFetch<SubjectAttributionDTO[]>(
      `/subject-attribution/by-unit/${unitId}${buildQueryString(query)}`,
    );
  },

  listBySubject: async (
    entityId: string,
    query?: SubjectAttributionBySubjectQuery,
  ): Promise<SubjectAttributionDTO[]> => {
    return apiFetch<SubjectAttributionDTO[]>(
      `/subject-attribution/by-subject/${entityId}${buildQueryString(query)}`,
    );
  },

  link: async (
    input: LinkSubjectAttributionInput,
  ): Promise<SubjectAttributionDTO> => {
    return apiFetch<SubjectAttributionDTO>("/subject-attribution", {
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
      `/subject-attribution/${unitId}/${entityId}/${role}`,
      { method: "DELETE" },
    );
  },
};
