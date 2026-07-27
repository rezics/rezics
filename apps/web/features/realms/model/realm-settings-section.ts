export const RealmSettingsSectionIds = [
	"profile",
	"members",
	"rules",
	"pins",
	"docks",
	"access",
	"moderation",
	"history",
] as const;

export type RealmSettingsSectionId = (typeof RealmSettingsSectionIds)[number];

export function isRealmSettingsSectionId(value: string): value is RealmSettingsSectionId {
	return RealmSettingsSectionIds.some((sectionId) => sectionId === value);
}

export type RealmSettingsPath =
	| {
			section?: Exclude<RealmSettingsSectionId, "members">;
			comparison: false;
			memberProfileId?: never;
	  }
	| { section: "members"; comparison: false; memberProfileId?: string }
	| { section: "history"; comparison: true; memberProfileId?: never };

export function parseRealmSettingsPath(
	segments: readonly string[] | undefined,
): RealmSettingsPath | undefined {
	if (!segments?.length) return { comparison: false };
	const first = segments[0];
	if (segments.length === 1 && first && isRealmSettingsSectionId(first))
		return { section: first, comparison: false };
	if (
		segments.length === 3 &&
		segments[0] === "members" &&
		segments[1] &&
		segments[2] === "permissions"
	)
		return {
			section: "members",
			comparison: false,
			memberProfileId: segments[1],
		};
	if (segments.length === 2 && segments[0] === "history" && segments[1] === "compare")
		return { section: "history", comparison: true };
	return undefined;
}
