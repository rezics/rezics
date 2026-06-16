import type { RealmSidebar } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { realmSidebarApi } from "./realm-sidebar.api";
import { realmSidebarKeys } from "./realm-sidebar.keys";

export function useUpdateRealmSidebarMutation(
  options?: Omit<
    UseMutationOptions<
      RealmSidebar,
      Error,
      { realmId: string; sidebar: RealmSidebar }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ realmId, sidebar }) =>
      realmSidebarApi.update(realmId, sidebar),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        realmSidebarKeys.detail(variables.realmId),
        data,
      );
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(variables.realmId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
