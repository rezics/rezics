export const SidebarFollowingKinds = ["zone", "realm"] as const;

export type SidebarFollowingKind = (typeof SidebarFollowingKinds)[number];

export function isSidebarFollowingKind(value: string): value is SidebarFollowingKind {
	return SidebarFollowingKinds.some((kind) => kind === value);
}

export function sidebarFollowingHref(
	kind: SidebarFollowingKind,
	value: string | AddressableUnit,
): string {
	const unit = typeof value === "string" ? { id: value } : value;
	switch (kind) {
		case "zone":
			return zoneHref(unit);
		case "realm":
			return realmHref(unit);
	}
}
import { realmHref, type AddressableUnit, zoneHref } from "@/features/slugs/unit-route";
