// API client
export { entityApi } from "./entity.api";

// Query keys
export { entityKeys } from "./entity.keys";

// Mutation hooks
export {
  entityMutations,
  useCreateEntity,
  useDeleteEntity,
  useUpdateEntity,
} from "./entity.mutations";

// Query configurations and hooks
export {
  entityBySlugQueryOptions,
  entityDetailQueryOptions,
  entityListQueryOptions,
  entityQueries,
  entitySearchQueryOptions,
  useEntity,
  useEntityBySlug,
  useEntityList,
  useEntitySearch,
} from "./entity.queries";

// Types
export type {
  CreateEntityInput,
  EntityDTO,
  EntityKind,
  EntityListQuery,
  EntityListResponse,
  EntitySearchOptions,
  EntitySearchResult,
  UpdateEntityInput,
} from "./entity.types";
