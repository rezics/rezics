import type { GameSystemRequirementListFilters } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { gameSystemRequirementApi } from "./game-system-requirement.api";
import { gameSystemRequirementKeys } from "./game-system-requirement.keys";

export const gameSystemRequirementListQueryOptions = (
  filters?: GameSystemRequirementListFilters,
) =>
  queryOptions({
    queryKey: gameSystemRequirementKeys.list(filters),
    queryFn: () => gameSystemRequirementApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

export const gameSystemRequirementsByGameQueryOptions = (
  gameUnitId: string,
  filters?: Omit<GameSystemRequirementListFilters, "gameUnitId">,
) =>
  queryOptions({
    queryKey: gameSystemRequirementKeys.byGame(gameUnitId, filters),
    queryFn: () => gameSystemRequirementApi.list({ ...filters, gameUnitId }),
    enabled: !!gameUnitId,
    staleTime: 1000 * 60 * 5,
  });

export const gameSystemRequirementDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: gameSystemRequirementKeys.detail(id),
    queryFn: () => gameSystemRequirementApi.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

export function useGameSystemRequirementList(
  filters?: GameSystemRequirementListFilters,
) {
  return useQuery(gameSystemRequirementListQueryOptions(filters));
}

export function useGameSystemRequirementsByGame(
  gameUnitId: string,
  filters?: Omit<GameSystemRequirementListFilters, "gameUnitId">,
) {
  return useQuery(
    gameSystemRequirementsByGameQueryOptions(gameUnitId, filters),
  );
}

export function useGameSystemRequirement(id: string) {
  return useQuery(gameSystemRequirementDetailQueryOptions(id));
}

export const gameSystemRequirementQueries = {
  list: gameSystemRequirementListQueryOptions,
  byGame: gameSystemRequirementsByGameQueryOptions,
  detail: gameSystemRequirementDetailQueryOptions,
};
