import type { RealmSettingsSectionId } from "../model/realm-settings-section";

export function realmSettingsSectionHref(
	baseHref: string,
	sectionId: RealmSettingsSectionId,
): string {
	return `${baseHref}/${sectionId}`;
}

export function realmSettingsHistoryCompareHref(baseHref: string): string {
	return `${realmSettingsSectionHref(baseHref, "history")}/compare`;
}
