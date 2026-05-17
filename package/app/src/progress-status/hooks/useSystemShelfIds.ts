import type { SystemShelfKindKey } from "@rezics/contract";
import { useSystemShelfRef } from "@rezics/api/slug";

export type SystemShelfIdMap = Partial<Record<SystemShelfKindKey, string>>;

export type SystemShelfMissingMap = Record<SystemShelfKindKey, boolean>;

export type UseSystemShelfIdsResult = {
  isLoading: boolean;
  shelfIds: SystemShelfIdMap;
  /**
   * Per-kindKey "authenticated viewer, slug resolved, no row" signal. UI
   * surfaces (recovery toasts, system-shelf recovery prompts) consult this
   * to decide when to surface the explicit `/shelf/system/ensure` flow.
   */
  missing: SystemShelfMissingMap;
  /** `true` if any of the four system shelves is missing for the viewer. */
  anyMissing: boolean;
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

  const missing: SystemShelfMissingMap = {
    favorites: favorites.missing,
    backlog: backlog.missing,
    active: active.missing,
    completed: completed.missing,
  };

  const isLoading =
    favorites.isLoading ||
    backlog.isLoading ||
    active.isLoading ||
    completed.isLoading;

  const anyMissing =
    missing.favorites || missing.backlog || missing.active || missing.completed;

  return {
    isLoading,
    shelfIds,
    missing,
    anyMissing,
    getShelfId: (kindKey) => shelfIds[kindKey],
  };
}
