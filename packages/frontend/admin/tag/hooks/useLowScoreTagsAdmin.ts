import type {
  LowScoreTagsQuery,
  LowScoreTagsResponse,
  PatchRealmTagApplicationInput,
  PatchUnitTagInput,
  RealmTagApplicationDTO,
  UnitTagDTO,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
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

const fetchLowScoreTags = createEdenFetcher<
  LowScoreTagsResponse,
  LowScoreTagsKey
>((key) => {
  const [, , , query] = key;
  return apiClient.admin["low-score-tag"].get({ query });
});

export function useLowScoreTagsQuery(query: LowScoreTagsQuery) {
  return useAdminEdenQuery(lowScoreTagsKey(query), fetchLowScoreTags, {
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });
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
