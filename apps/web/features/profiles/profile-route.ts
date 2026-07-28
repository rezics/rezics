import { addressableUnitHref, type AddressableUnit } from "@/features/slugs/unit-route";

export const ProfileSections = ["profile", "activity", "content"] as const;

export type ProfileSection = (typeof ProfileSections)[number];

export function profileHref(
	profile: string | AddressableUnit,
	section: ProfileSection = "profile",
): string {
	const profilePath = addressableUnitHref(
		"profile",
		typeof profile === "string" ? { id: profile } : profile,
	);
	return section === "profile" ? profilePath : `${profilePath}/${section}`;
}
