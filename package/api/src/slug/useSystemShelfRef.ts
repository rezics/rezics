import type { SlugResolveResponse, SystemShelfKindKey } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "../hooks/useCurrentUserId";
import { slugResolveQuery } from "./slug.queries";

export type UseSystemShelfRefResult = {
  /** `true` while the viewer is logged in and the slug resolution is in flight. */
  isLoading: boolean;
  /**
   * The unit id of the viewer's system shelf for the given `kindKey`, once
   * resolved. `null` for unauthenticated viewers or while loading.
   */
  unitId: string | null;
  /**
   * `true` only when the viewer is authenticated, the slug resolution has
   * settled, and no Unit row was returned. Differentiates "still loading
   * at first paint" and "unauthenticated viewer" from the orphan state
   * surfaced by the recovery flow.
   */
  missing: boolean;
  data: SlugResolveResponse | undefined;
};

/**
 * Pure projection of (viewer auth state, query state) → `UseSystemShelfRefResult`.
 *
 * Exposed for unit tests because the React hook can't be exercised from
 * `bun:test` without a full DOM + testing-library setup.
 */
export function computeSystemShelfRefResult(args: {
  viewerUnitId: string | null | undefined;
  isLoading: boolean;
  data: SlugResolveResponse | undefined;
}): UseSystemShelfRefResult {
  const enabled = !!args.viewerUnitId;
  const unitId = args.data?.unitId ?? null;
  const settled = enabled && !args.isLoading;
  return {
    isLoading: enabled && args.isLoading,
    unitId,
    missing: settled && unitId == null,
    data: args.data,
  };
}

/**
 * Resolve the viewer's system-shelf `Unit.id` for a given `kindKey` via the
 * standard `(scope, slug)` slug index. The viewer's `User.unitId` is the
 * owner scope; the slug is the system `kindKey` (`favorites` | `saved` | `backlog` |
 * `active` | `completed`).
 *
 * This is the canonical client-side resolution for system shelves. There is
 * no user-DTO field carrying these ids; the slug index is the only source.
 */
export function useSystemShelfRef(
  kindKey: SystemShelfKindKey,
): UseSystemShelfRefResult {
  const viewerUnitId = useCurrentUserId();
  const enabled = !!viewerUnitId;
  const query = useQuery({
    ...slugResolveQuery({ scope: viewerUnitId ?? "", slug: kindKey }),
    enabled,
  });
  return computeSystemShelfRefResult({
    viewerUnitId,
    isLoading: query.isLoading,
    data: query.data,
  });
}
