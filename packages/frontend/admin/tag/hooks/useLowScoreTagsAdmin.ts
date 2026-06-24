import type {
  LowScoreTagsQuery,
  LowScoreTagsResponse,
  PatchRealmTagApplicationInput,
  PatchUnitTagInput,
  RealmTagApplicationDTO,
  UnitTagDTO,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type LowScoreTagsKey = readonly [
  "eden",
  "admin",
  "low-score-tag",
  LowScoreTagsQuery,
];

function lowScoreTagsKey(query: LowScoreTagsQuery): LowScoreTagsKey {
  return ["eden", "admin", "low-score-tag", query] as const;
}

async function fetchLowScoreTags(
  key: LowScoreTagsKey,
): Promise<LowScoreTagsResponse> {
  const [, , , query] = key;
  const response = await apiClient.admin["low-score-tag"].get({ query });
  return unwrapEdenResponse(response);
}

export function useLowScoreTagsQuery(query: LowScoreTagsQuery) {
  const result = useSWR<LowScoreTagsResponse>(
    lowScoreTagsKey(query),
    fetchLowScoreTags,
    {
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isLoading: result.isLoading,
    refetch: () => result.mutate(),
  };
}

export async function patchUnitTag(
  unitId: string,
  tagUnitId: string,
  input: PatchUnitTagInput,
): Promise<UnitTagDTO> {
  const response = await apiClient["unit-tag"]({ unitId })({ tagUnitId }).patch(
    input,
  );
  return unwrapEdenResponse(response);
}

export async function deleteUnitTag(
  unitId: string,
  tagUnitId: string,
): Promise<{ message: string }> {
  const response = await apiClient["unit-tag"]({ unitId })({
    tagUnitId,
  }).delete();
  return unwrapEdenResponse(response);
}

export async function patchRealmTagApplication(
  realmUnitId: string,
  unitId: string,
  tagUnitId: string,
  input: PatchRealmTagApplicationInput,
): Promise<RealmTagApplicationDTO> {
  const response = await apiClient["realm-tag-application"]({
    realmUnitId,
  })({ unitId })({ tagUnitId }).patch(input);
  return unwrapEdenResponse(response);
}

export async function deleteRealmTagApplication(
  realmUnitId: string,
  unitId: string,
  tagUnitId: string,
): Promise<{ message: string }> {
  const response = await apiClient["realm-tag-application"]({
    realmUnitId,
  })({ unitId })({ tagUnitId }).delete();
  return unwrapEdenResponse(response);
}
