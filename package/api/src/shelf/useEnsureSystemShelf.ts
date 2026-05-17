import type {
  EnsureSystemShelfResponse,
  SystemShelfKindKey,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCurrentUserId } from "../hooks/useCurrentUserId";
import { slugKeys } from "../slug/slug.keys";
import { shelfApi } from "./shelf.api";

/**
 * User-driven recovery hook for the rare orphan-state case where a system
 * shelf is missing for the authenticated viewer. Wired into the recovery
 * toast surfaced on `system_shelf_missing` 404s — never auto-triggered.
 *
 * On success this invalidates the `slugResolveQuery({ scope: viewer, slug:
 * kindKey })` cache entry so the next read picks up the freshly-minted
 * unitId. The original mutation is NOT auto-replayed; the user re-issues
 * the action themselves.
 *
 * Caller is responsible for surfacing errors via a toast. The mutation
 * deliberately disables retry-on-error so the user controls when to retry.
 */
export function useEnsureSystemShelf(
  options?: Omit<
    UseMutationOptions<
      EnsureSystemShelfResponse,
      Error,
      SystemShelfKindKey
    >,
    "mutationFn" | "retry"
  >,
) {
  const queryClient = useQueryClient();
  const viewerUnitId = useCurrentUserId();
  return useMutation({
    mutationFn: (kindKey: SystemShelfKindKey) => shelfApi.ensureSystem(kindKey),
    retry: false,
    ...options,
    onSuccess: (data, kindKey, onMutateResult, context) => {
      if (viewerUnitId) {
        queryClient.invalidateQueries({
          queryKey: slugKeys.resolve({ scope: viewerUnitId, slug: kindKey }),
        });
      }
      options?.onSuccess?.(data, kindKey, onMutateResult, context);
    },
  });
}
