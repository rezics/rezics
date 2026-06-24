export { entityApi } from "./entity.api";

export { entityKeys } from "./entity.keys";

export {
  entityMutations,
  useCreateEntity,
  useDeleteEntity,
  useUpdateEntity,
} from "./entity.mutations";

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
