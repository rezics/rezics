import type { SystemShelfKindKey } from "@rezics/contract";
import { useSystemShelfRef } from "@rezics/api/slug";

export type SystemShelfIdMap = Partial<Record<SystemShelfKindKey, string>>;

export type UseSystemShelfIdsResult = {
  isLoading: boolean;
  shelfIds: SystemShelfIdMap;
  getShelfId: (kindKey: SystemShelfKindKey) => string | undefined;
};

/**
 * Resolve the viewer's four system shelf ids through the slug system.
 *
 * Each `kindKey` resolves under `scope = viewer.unitId`, slug = kindKey
 * (see openspec change `shelf-system-slugs`). The `(scope, slug)` index is
 * the canonical lookup; no user-DTO field carries these ids.
 */
export function useSystemShelfIds(): UseSystemShelfIdsResult {
  const favorites = useSystemShelfRef("favorites");
  const backlog = useSystemShelfRef("backlog");
  const active = useSystemShelfRef("active");
  const completed = useSystemShelfRef("completed");

  const shelfIds: SystemShelfIdMap = {};
  if (favorites.unitId) shelfIds.favorites = favorites.unitId;
  if (backlog.unitId) shelfIds.backlog = backlog.unitId;
  if (active.unitId) shelfIds.active = active.unitId;
  if (completed.unitId) shelfIds.completed = completed.unitId;

  const isLoading =
    favorites.isLoading ||
    backlog.isLoading ||
    active.isLoading ||
    completed.isLoading;

  return {
    isLoading,
    shelfIds,
    getShelfId: (kindKey) => shelfIds[kindKey],
  };
}
