import type { RealmPermission } from "@rezics/access";

export type RealmCapability = RealmPermission;

export function isRealmVisible(status: string, visibility: string, membershipState?: string) {
	return (
		status.toLowerCase() === "published" &&
		(visibility.toLowerCase() !== "private" ||
			["active", "muted"].includes(membershipState?.toLowerCase() ?? ""))
	);
}

export function isRealmJoinable(status: string, visibility: string, membershipState?: string) {
	if (["banned"].includes(membershipState?.toLowerCase() ?? "")) return false;
	return (
		status.toLowerCase() === "published" &&
		(visibility.toLowerCase() !== "private" ||
			["active", "pending"].includes(membershipState?.toLowerCase() ?? ""))
	);
}
