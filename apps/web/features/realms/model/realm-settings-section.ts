export const RealmSettingsSectionIds = [
	"profile",
	"members",
	"rules",
	"pins",
	"access",
	"moderation",
	"history",
] as const;

export type RealmSettingsSectionId = (typeof RealmSettingsSectionIds)[number];

export function isRealmSettingsSectionId(value: string): value is RealmSettingsSectionId {
	return RealmSettingsSectionIds.some((sectionId) => sectionId === value);
}

export type RealmSettingsPath =
	| { section?: RealmSettingsSectionId; comparison: false }
	| { section: "history"; comparison: true };

export function parseRealmSettingsPath(
	segments: readonly string[] | undefined,
): RealmSettingsPath | undefined {
	if (!segments?.length) return { comparison: false };
	const first = segments[0];
	if (segments.length === 1 && first && isRealmSettingsSectionId(first))
		return { section: first, comparison: false };
	if (segments.length === 2 && segments[0] === "history" && segments[1] === "compare")
		return { section: "history", comparison: true };
	return undefined;
}
