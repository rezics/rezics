export type {
  LinkSubjectAttributionInput,
  SubjectAttributionBySubjectQuery,
  SubjectAttributionByUnitQuery,
  SubjectAttributionDTO,
} from "@rezics/contract";
export { subjectAttributionApi } from "./subject-attribution.api";
export { subjectAttributionKeys } from "./subject-attribution.keys";
export {
  subjectAttributionMutations,
  useLinkSubjectAttributionMutation,
  useUnlinkSubjectAttributionMutation,
} from "./subject-attribution.mutations";
export {
  subjectAttributionQueries,
  subjectAttributionsBySubjectQueryOptions,
  subjectAttributionsByUnitQueryOptions,
} from "./subject-attribution.queries";
