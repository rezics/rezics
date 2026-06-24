export type {
  CreateGameSystemRequirementInput,
  GameSystemRequirementDTO,
  GameSystemRequirementHardware,
  GameSystemRequirementListFilters,
  GameSystemRequirementListResponse,
  GameSystemRequirementSummary,
  GameSystemRequirementTier,
  UpdateGameSystemRequirementInput,
} from "@rezics/contract";
export { gameSystemRequirementApi } from "./game-system-requirement.api";
export { gameSystemRequirementKeys } from "./game-system-requirement.keys";
export {
  gameSystemRequirementDetailQueryOptions,
  gameSystemRequirementListQueryOptions,
  gameSystemRequirementQueries,
  gameSystemRequirementsByGameQueryOptions,
  useGameSystemRequirement,
  useGameSystemRequirementList,
  useGameSystemRequirementsByGame,
} from "./game-system-requirement.queries";
