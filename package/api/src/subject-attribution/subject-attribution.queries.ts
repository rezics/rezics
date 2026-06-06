import type {
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { subjectAttributionApi } from "./subject-attribution.api";
import { subjectAttributionKeys } from "./subject-attribution.keys";

export const subjectAttributionsByUnitQueryOptions = (
  unitId: string,
  query?: SubjectAttributionByUnitQuery,
) =>
  queryOptions({
    queryKey: subjectAttributionKeys.byUnit(unitId, query),
    queryFn: () => subjectAttributionApi.listByUnit(unitId, query),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const subjectAttributionsBySubjectQueryOptions = (
  entityId: string,
  query?: SubjectAttributionBySubjectQuery,
) =>
  queryOptions({
    queryKey: subjectAttributionKeys.bySubject(entityId, query),
    queryFn: () => subjectAttributionApi.listBySubject(entityId, query),
    enabled: !!entityId,
    staleTime: 1000 * 60 * 5,
  });

export const subjectAttributionQueries = {
  byUnit: subjectAttributionsByUnitQueryOptions,
  bySubject: subjectAttributionsBySubjectQueryOptions,
};
