import { isSettingsSectionId, type SettingsSectionId } from "../model/settings-section";

export const SettingsOverviewHref = "/settings";

export function settingsSectionHref(sectionId: SettingsSectionId): string {
	return `${SettingsOverviewHref}/${sectionId}`;
}

export function parseSettingsSection(pathname: string): SettingsSectionId | undefined {
	const match = /^\/settings\/([^/]+)\/?$/.exec(pathname);
	const value = match?.[1];
	return value && isSettingsSectionId(value) ? value : undefined;
}
