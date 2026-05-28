import { getI18nRuntime } from "@rezics/i18n/runtime";
import type { SystemShelfKindKey } from "@rezics/contract";
const SYSTEM_SHELF_KIND_LABEL = {
  active: () => getI18nRuntime().i18n.t("entity:shelf_system_active"),
  backlog: () => getI18nRuntime().i18n.t("entity:shelf_system_backlog"),
  completed: () => getI18nRuntime().i18n.t("entity:shelf_system_completed"),
  favorites: () => getI18nRuntime().i18n.t("entity:shelf_system_favorites"),
} as const satisfies Record<SystemShelfKindKey, () => string>;

export function systemShelfKindLabel(kindKey: SystemShelfKindKey): string {
  return SYSTEM_SHELF_KIND_LABEL[kindKey]();
}
