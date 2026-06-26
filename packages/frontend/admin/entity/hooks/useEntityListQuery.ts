import type {
  EditorialPatchSubmission,
  EntityDTO,
  EntityListQuery,
  EntityListResponse,
} from "@rezics/contract";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type EntityListKey = readonly ["eden", "entity", "list", EntityListQuery];
type EntityDetailKey = readonly ["eden", "entity", "detail", string];
type EntityUpdateKey = readonly ["eden", "entity", "update", string];

function entityListKey(query: EntityListQuery): EntityListKey {
  return ["eden", "entity", "list", query] as const;
}

function entityDetailKey(unitId: string): EntityDetailKey {
  return ["eden", "entity", "detail", unitId] as const;
}

function entityUpdateKey(unitId: string): EntityUpdateKey {
  return ["eden", "entity", "update", unitId] as const;
}

const fetchEntityList = createEdenFetcher<
  EntityListResponse,
  EntityListKey
>((key) => {
  const [, , , query] = key;
  return apiClient.entity.get({ query });
});

const fetchEntityDetail = createEdenFetcher<EntityDTO, EntityDetailKey>(
  (key) => {
    const [, , , unitId] = key;
    return apiClient.entity({ unitId }).get();
  },
);

async function updateEntity(
  key: EntityUpdateKey,
  { arg }: { arg: EditorialPatchSubmission },
): Promise<EntityDTO> {
  const [, , , unitId] = key;
  const response = await apiClient.entity({ unitId }).patch(arg);

  return unwrapEdenResponse(response);
}

export function useEntityListQuery(query: EntityListQuery) {
  return useAdminEdenQuery(entityListKey(query), fetchEntityList, {
    dedupingInterval: 120_000,
    keepPreviousData: true,
  });
}

export function useEntityDetailQuery(unitId: string) {
  return useAdminEdenQuery(
    unitId ? entityDetailKey(unitId) : null,
    fetchEntityDetail,
    {
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );
}

export function useUpdateEntityMutation(unitId: string) {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    EntityDTO,
    Error,
    EntityUpdateKey,
    EditorialPatchSubmission
  >(
    entityUpdateKey(unitId),
    updateEntity,
  );

  const mutateAsync = async (input: EditorialPatchSubmission) => {
    const entity = await mutation.trigger(input);
    await mutate(entityDetailKey(unitId), entity, { revalidate: false });
    await mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === "eden" &&
        key[1] === "entity" &&
        key[2] === "list",
    );
    return entity;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}
