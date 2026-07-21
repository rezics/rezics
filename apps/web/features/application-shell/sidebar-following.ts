export const SidebarFollowingKinds = ["zone", "realm"] as const;

export type SidebarFollowingKind = (typeof SidebarFollowingKinds)[number];

export function isSidebarFollowingKind(value: string): value is SidebarFollowingKind {
	return SidebarFollowingKinds.some((kind) => kind === value);
}

export function sidebarFollowingHref(kind: SidebarFollowingKind, id: string) {
	switch (kind) {
		case "zone":
			return `/zones/${id}`;
		case "realm":
			return `/realms/${id}`;
	}
}
