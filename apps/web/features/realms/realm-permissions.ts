import type { GetApiRealmsByRealmIdStatus200 } from "@rezics/openapi-tanstack-query";

type RealmMembership = GetApiRealmsByRealmIdStatus200["viewerMembership"];

export function canManageRealm(membership: RealmMembership) {
	return Boolean(
		membership?.state === "active" && ["owner", "admin", "moderator"].includes(membership.role),
	);
}

export function isRealmOwner(membership: RealmMembership) {
	return membership?.state === "active" && membership.role === "owner";
}
