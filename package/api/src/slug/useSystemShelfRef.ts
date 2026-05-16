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
  data: SlugResolveResponse | undefined;
};

/**
 * Resolve the viewer's system-shelf `Unit.id` for a given `kindKey` via the
 * standard `(scope, slug)` slug index. The viewer's `User.unitId` is the
 * owner scope; the slug is the system `kindKey` (`favorites` | `backlog` |
 * `active` | `completed`).
 *
 * This is the canonical client-side resolution for system shelves. There is
 * no user-DTO field carrying these ids — see openspec change
 * `shelf-system-slugs`.
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
  return {
    isLoading: enabled && query.isLoading,
    unitId: query.data?.unitId ?? null,
    data: query.data,
  };
}
