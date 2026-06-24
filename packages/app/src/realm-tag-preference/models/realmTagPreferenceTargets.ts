import {
  CATALOG_UNIT_TYPES,
  type RealmTagDisplayTarget,
  UnitType,
} from "@rezics/contract";

export const REALM_TAG_DISPLAY_TARGETS = CATALOG_UNIT_TYPES;

export function realmTagDisplayTargetLabel(
  t: (key: string) => string,
  target: RealmTagDisplayTarget,
): string {
  switch (target) {
    case UnitType.GAME:
      return t("settings:realm_tag_preference_target_GAME");
    case UnitType.MEDIA:
      return t("settings:realm_tag_preference_target_MEDIA");
    default:
      return t("settings:realm_tag_preference_target_BOOK");
  }
}
