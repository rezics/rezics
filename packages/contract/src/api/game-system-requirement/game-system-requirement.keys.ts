import type { GameSystemRequirementListFilters } from "@rezics/contract";

export const gameSystemRequirementKeys = {
  all: () => ["game-system-requirement"] as const,
  lists: () => [...gameSystemRequirementKeys.all(), "list"] as const,
  list: (filters?: GameSystemRequirementListFilters) =>
    [...gameSystemRequirementKeys.lists(), filters] as const,
  byGame: (
    gameUnitId: string,
    filters?: Omit<GameSystemRequirementListFilters, "gameUnitId">,
  ) =>
    [
      ...gameSystemRequirementKeys.lists(),
      "game",
      gameUnitId,
      filters,
    ] as const,
  details: () => [...gameSystemRequirementKeys.all(), "detail"] as const,
  detail: (id: string) => [...gameSystemRequirementKeys.details(), id] as const,
} as const;
