import type { SystemShelfKindKey } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";

const SYSTEM_SHELF_KIND_LABEL = {
  active: m.shelf_system_active,
  backlog: m.shelf_system_backlog,
  completed: m.shelf_system_completed,
  favorites: m.shelf_system_favorites,
} as const satisfies Record<SystemShelfKindKey, () => string>;

export function systemShelfKindLabel(kindKey: SystemShelfKindKey): string {
  return SYSTEM_SHELF_KIND_LABEL[kindKey]();
}
