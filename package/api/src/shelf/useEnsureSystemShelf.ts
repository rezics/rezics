import type {
  EnsureSystemShelfResponse,
  ReservedShelfSlug,
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
 * Low-level ensure mutation for the rare orphan-state case where a system
 * shelf is missing for the authenticated viewer.
 *
 * On success this invalidates the `slugResolveQuery({ scope: viewer, slug })`
 * cache entry so the next read picks up the freshly-minted unitId.
 *
 * The mutation deliberately disables retry-on-error; callers decide whether
 * and how to surface or retry recovery.
 */
export function useEnsureSystemShelf(
  options?: Omit<
    UseMutationOptions<EnsureSystemShelfResponse, Error, ReservedShelfSlug>,
    "mutationFn" | "retry"
  >,
) {
  const queryClient = useQueryClient();
  const viewerUnitId = useCurrentUserId();
  return useMutation({
    mutationFn: (slug: ReservedShelfSlug) => shelfApi.ensureSystem(slug),
    retry: false,
    ...options,
    onSuccess: (data, slug, onMutateResult, context) => {
      if (viewerUnitId) {
        queryClient.invalidateQueries({
          queryKey: slugKeys.resolve({ scope: viewerUnitId, slug }),
        });
      }
      options?.onSuccess?.(data, slug, onMutateResult, context);
    },
  });
}
