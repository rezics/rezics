export const SettingsSectionIds = [
	"profile",
	"preferences",
	"account",
	"security",
	"invitations",
] as const;

export type SettingsSectionId = (typeof SettingsSectionIds)[number];

export function isSettingsSectionId(value: string): value is SettingsSectionId {
	return SettingsSectionIds.some((sectionId) => sectionId === value);
}
