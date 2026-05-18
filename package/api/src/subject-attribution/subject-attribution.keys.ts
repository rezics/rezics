import type {
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
} from "@rezics/contract";

export const subjectAttributionKeys = {
  all: () => ["subject-attribution"] as const,
  byUnit: (unitId: string, query?: SubjectAttributionByUnitQuery) =>
    [...subjectAttributionKeys.all(), "by-unit", unitId, query] as const,
  bySubject: (entityId: string, query?: SubjectAttributionBySubjectQuery) =>
    [...subjectAttributionKeys.all(), "by-subject", entityId, query] as const,
} as const;
