import { useSystemShelfRef } from "@rezics/api/slug";
import type { SystemShelfKindKey } from "@rezics/contract";

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
  /** `true` if any platform system shelf is missing for the viewer. */
  anyMissing: boolean;
  getShelfId: (kindKey: SystemShelfKindKey) => string | undefined;
};

/**
 * Resolve the viewer's system shelf ids through the slug system.
 *
 * Each `kindKey` resolves under `scope = viewer.unitId`, slug = kindKey.
 * The `(scope, slug)` index is the canonical lookup; no user-DTO field
 * carries these ids.
 */
export function useSystemShelfIds(): UseSystemShelfIdsResult {
  const favorites = useSystemShelfRef("favorites");
  const saved = useSystemShelfRef("saved");
  const backlog = useSystemShelfRef("backlog");
  const active = useSystemShelfRef("active");
  const completed = useSystemShelfRef("completed");

  const shelfIds: SystemShelfIdMap = {};
  if (favorites.unitId) shelfIds.favorites = favorites.unitId;
  if (saved.unitId) shelfIds.saved = saved.unitId;
  if (backlog.unitId) shelfIds.backlog = backlog.unitId;
  if (active.unitId) shelfIds.active = active.unitId;
  if (completed.unitId) shelfIds.completed = completed.unitId;

  const missing: SystemShelfMissingMap = {
    favorites: favorites.missing,
    saved: saved.missing,
    backlog: backlog.missing,
    active: active.missing,
    completed: completed.missing,
  };

  const isLoading =
    favorites.isLoading ||
    saved.isLoading ||
    backlog.isLoading ||
    active.isLoading ||
    completed.isLoading;

  const anyMissing =
    missing.favorites ||
    missing.saved ||
    missing.backlog ||
    missing.active ||
    missing.completed;

  return {
    isLoading,
    shelfIds,
    missing,
    anyMissing,
    getShelfId: (kindKey) => shelfIds[kindKey],
  };
}
