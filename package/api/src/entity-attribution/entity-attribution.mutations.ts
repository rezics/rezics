import type {
  EntityAttributionBatchRequest,
  EntityAttributionBatchResponse,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { creditAttributionKeys } from "../credit-attribution/credit-attribution.keys";
import { subjectAttributionKeys } from "../subject-attribution/subject-attribution.keys";
import { entityAttributionApi } from "./entity-attribution.api";
import { entityAttributionKeys } from "./entity-attribution.keys";

export type EntityAttributionBatchMutationInput = {
  unitId: string;
  request: EntityAttributionBatchRequest;
};

// Invalidation is declared via `meta.invalidates` (see `react-query/tsr.ts`):
// the global MutationCache handler refreshes these prefixes on success, so no
// mutation here needs `useQueryClient()` or a hand-wired `onSuccess`. The
// caller's own `onSuccess` therefore passes through untouched.
// 失效通过 `meta.invalidates` 声明（见 `react-query/tsr.ts`）：全局 MutationCache
// handler 在成功时刷新这些前缀，因此这里没有 mutation 需要 `useQueryClient()`
// 或手写 `onSuccess`。调用方自己的 `onSuccess` 因此原样透传。
const invalidates = [
  creditAttributionKeys.all(),
  subjectAttributionKeys.all(),
  entityAttributionKeys.all(),
  bookKeys.all(),
];

export function useEntityAttributionBatchMutation(
  options?: Omit<
    UseMutationOptions<
      EntityAttributionBatchResponse,
      Error,
      EntityAttributionBatchMutationInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, request }) =>
      entityAttributionApi.batchUpdate(unitId, request),
    ...options,
    meta: { invalidates },
  });
}

export const entityAttributionMutations = {
  useBatch: useEntityAttributionBatchMutation,
};
