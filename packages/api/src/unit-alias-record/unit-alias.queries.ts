import type { UnitAliasListQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { unitAliasApi } from "./unit-alias.api";
import { unitAliasKeys } from "./unit-alias.keys";

export const unitAliasesQuery = (query?: UnitAliasListQuery) =>
  queryOptions({
    queryKey: unitAliasKeys.list(query),
    queryFn: () => unitAliasApi.list(query),
  });

export const unitAliasesForUnitQuery = (
  unitId: string,
  query?: Omit<UnitAliasListQuery, "unitId">,
) =>
  queryOptions({
    queryKey: unitAliasKeys.forUnit(unitId),
    queryFn: () => unitAliasApi.list({ ...query, unitId }),
  });

export const unitAliasQueries = {
  list: unitAliasesQuery,
  forUnit: unitAliasesForUnitQuery,
};
