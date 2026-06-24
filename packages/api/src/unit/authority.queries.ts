import { queryOptions } from "@tanstack/react-query";
import { unitAuthorityApi } from "./authority.api";
import { unitAuthorityKeys } from "./authority.keys";

export const unitCollaboratorsQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: unitAuthorityKeys.collaborators(unitId),
    queryFn: () => unitAuthorityApi.listCollaborators(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const unitFieldLocksQueryOptions = (unitId: string) =>
  queryOptions({
    queryKey: unitAuthorityKeys.fieldLocks(unitId),
    queryFn: () => unitAuthorityApi.listFieldLocks(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const unitAuthorityQueries = {
  collaborators: unitCollaboratorsQueryOptions,
  fieldLocks: unitFieldLocksQueryOptions,
};
