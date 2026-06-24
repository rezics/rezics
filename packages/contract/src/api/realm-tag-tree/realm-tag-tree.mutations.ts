import type { UpdateRealmTagTreeInput } from "@rezics/contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { realmTagTreeApi } from "./realm-tag-tree.api";
import { realmTagTreeKeys } from "./realm-tag-tree.keys";

export function useUpdateRealmTagTreeMutation(realmId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRealmTagTreeInput) =>
      realmTagTreeApi.update(realmId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: realmTagTreeKeys.detail(realmId),
      }),
  });
}
