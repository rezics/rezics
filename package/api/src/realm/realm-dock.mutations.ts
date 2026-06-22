import type { RealmDock } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmDockApi } from "./realm-dock.api";
import { realmDockKeys } from "./realm-dock.keys";
import { realmKeys } from "./realm.keys";

const realmDockInvalidates = [realmKeys.all()];

export function useUpdateRealmDockMutation(
  options?: Omit<
    UseMutationOptions<RealmDock, Error, { realmId: string; dock: RealmDock }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, dock }) => realmDockApi.update(realmId, dock),
    meta: { invalidates: realmDockInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(realmDockKeys.detail(variables.realmId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
