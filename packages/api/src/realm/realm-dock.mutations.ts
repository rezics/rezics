import type { RealmDock } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmDockApi } from "./realm-dock.api";
import { realmDockKeys } from "./realm-dock.keys";
import { realmKeys } from "./realm.keys";

export function useUpdateRealmDockMutation(
  options?: Omit<
    UseMutationOptions<RealmDock, Error, { realmId: string; dock: RealmDock }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, dock }) => realmDockApi.update(realmId, dock),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(realmDockKeys.detail(variables.realmId), data);
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(variables.realmId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
