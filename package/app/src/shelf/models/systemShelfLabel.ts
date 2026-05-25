import type { SystemShelfKindKey } from "@rezics/contract";
import {
  shelf_system_active,
  shelf_system_backlog,
  shelf_system_completed,
  shelf_system_favorites,
} from "@rezics/i18n/messages";

const SYSTEM_SHELF_KIND_LABEL = {
  active: shelf_system_active,
  backlog: shelf_system_backlog,
  completed: shelf_system_completed,
  favorites: shelf_system_favorites,
} as const satisfies Record<SystemShelfKindKey, () => string>;

export function systemShelfKindLabel(kindKey: SystemShelfKindKey): string {
  return SYSTEM_SHELF_KIND_LABEL[kindKey]();
}
