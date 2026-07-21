import type { PublicSlugHrefStyle } from "@rezics/slug";

import { addressableUnitHref, type AddressableUnit } from "@/features/slugs/unit-route";

export const ProfileSections = ["profile", "content"] as const;

export type ProfileSection = (typeof ProfileSections)[number];

export function profileHref(
	profile: string | AddressableUnit,
	section: ProfileSection = "profile",
	style: PublicSlugHrefStyle = "canonical",
): string {
	const profilePath = addressableUnitHref(
		"profile",
		typeof profile === "string" ? { id: profile } : profile,
		style,
	);
	return section === "profile" ? profilePath : `${profilePath}/${section}`;
}
