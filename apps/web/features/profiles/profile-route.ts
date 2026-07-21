export const ProfileSections = ["profile", "content"] as const;

export type ProfileSection = (typeof ProfileSections)[number];

export function profileHref(profileId: string, section: ProfileSection = "profile"): string {
	const profilePath = `/user/${profileId}/profile`;
	return section === "profile" ? profilePath : `${profilePath}/${section}`;
}
