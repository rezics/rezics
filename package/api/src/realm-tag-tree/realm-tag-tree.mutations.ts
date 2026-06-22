import type { UpdateRealmTagTreeInput } from "@rezics/contract";
import { useMutation } from "@tanstack/react-query";
import { realmTagTreeApi } from "./realm-tag-tree.api";
import { realmTagTreeKeys } from "./realm-tag-tree.keys";

// ponytail: root prefix; per-realm granularity if perf matters
const invalidates = [realmTagTreeKeys.all()];

export function useUpdateRealmTagTreeMutation(realmId: string) {
  return useMutation({
    mutationFn: (input: UpdateRealmTagTreeInput) =>
      realmTagTreeApi.update(realmId, input),
    meta: { invalidates },
  });
}
