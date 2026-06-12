import type { SystemShelfKindKey } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";

const SYSTEM_SHELF_KIND_LABEL = {
  active: () => getI18nRuntime().i18n.t("entity:shelf_system_active"),
  backlog: () => getI18nRuntime().i18n.t("entity:shelf_system_backlog"),
  completed: () => getI18nRuntime().i18n.t("entity:shelf_system_completed"),
  favorites: () => getI18nRuntime().i18n.t("entity:shelf_system_favorites"),
  saved: () => getI18nRuntime().i18n.t("entity:shelf_system_saved"),
} as const satisfies Record<SystemShelfKindKey, () => string>;

export function systemShelfKindLabel(kindKey: SystemShelfKindKey): string {
  return SYSTEM_SHELF_KIND_LABEL[kindKey]();
}

// Handles both system and custom shelf kinds
// 处理系统和自定义书架类型
export function shelfKindLabel(kindKey: string): string {
  const { i18n } = getI18nRuntime();
  switch (kindKey) {
    case "favorites":
      return i18n.t("entity:shelf_system_favorites");
    case "saved":
      return i18n.t("entity:shelf_system_saved");
    case "backlog":
      return i18n.t("entity:shelf_system_backlog");
    case "active":
      return i18n.t("entity:shelf_system_active");
    case "completed":
      return i18n.t("entity:shelf_system_completed");
    case "CUSTOM":
      return i18n.t("entity:shelf_kind_custom");
    case "FAVORITES":
      return i18n.t("entity:shelf_kind_favorites");
    case "PLAYLIST":
      return i18n.t("entity:shelf_kind_playlist");
    case "READING_LIST":
      return i18n.t("entity:shelf_kind_reading_list");
    case "WATCHLIST":
      return i18n.t("entity:shelf_kind_watchlist");
    default:
      return kindKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
