export type {
  CastUnitAliasVoteInput,
  CreateUnitAliasInput,
  PatchUnitAliasPinInput,
  UnitAliasDTO,
  UnitAliasListQuery,
  UpdateUnitAliasInput,
} from "@rezics/contract";
export { unitAliasApi } from "./unit-alias.api";
export { unitAliasKeys } from "./unit-alias.keys";
export {
  unitAliasMutations,
  useCastUnitAliasVoteMutation,
  useCreateUnitAliasMutation,
  useDeleteUnitAliasMutation,
  useHideUnitAliasMutation,
  usePatchUnitAliasPinMutation,
  useUpdateUnitAliasMutation,
} from "./unit-alias.mutations";
export {
  unitAliasesForUnitQuery,
  unitAliasesQuery,
  unitAliasQueries,
} from "./unit-alias.queries";
