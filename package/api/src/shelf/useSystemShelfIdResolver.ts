import type { SystemShelfKindKey } from "@rezics/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useCurrentUserId } from "../hooks/useCurrentUserId";
import { ApiError } from "../react-query/errors";
import { slugResolveQuery } from "../slug/slug.queries";
import { useSystemShelfRecovery } from "./useSystemShelfRecovery";

export type UseSystemShelfIdResolverResult = {
  resolve: (kindKey: SystemShelfKindKey) => Promise<string>;
  isPending: boolean;
};

/**
 * Resolve the viewer's system shelf id on demand. Missing rows are recovered
 * through the shared single-flight system shelf recovery hook.
 */
export function useSystemShelfIdResolver(): UseSystemShelfIdResolverResult {
  const queryClient = useQueryClient();
  const viewerUnitId = useCurrentUserId();
  const { ensure, isPending } = useSystemShelfRecovery();

  const resolve = useCallback(
    async (kindKey: SystemShelfKindKey): Promise<string> => {
      if (!viewerUnitId) {
        throw new Error(`No viewer id for ${kindKey}`);
      }

      try {
        const resolved = await queryClient.fetchQuery({
          ...slugResolveQuery({ scope: viewerUnitId, slug: kindKey }),
          retry: false,
        });
        return resolved.unitId;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }

        const ensured = await ensure(kindKey);
        return ensured.unitId;
      }
    },
    [ensure, queryClient, viewerUnitId],
  );

  return {
    resolve,
    isPending,
  };
}
