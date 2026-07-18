import { RealmCapabilityValues } from "../../database/schema";

export type RealmCapability = (typeof RealmCapabilityValues)[number];
export type RealmRuleTrigger = "post" | "update";

export function isRealmVisible(status: string, visibility: string, membershipState?: string) {
	return (
		status.toLowerCase() === "published" &&
		(visibility.toLowerCase() !== "private" || membershipState?.toLowerCase() === "active")
	);
}

export function isRealmJoinable(status: string, visibility: string, membershipState?: string) {
	if (["banned", "removed"].includes(membershipState?.toLowerCase() ?? "")) return false;
	return (
		status.toLowerCase() === "published" &&
		(visibility.toLowerCase() !== "private" ||
			["active", "pending"].includes(membershipState?.toLowerCase() ?? ""))
	);
}

export function shouldRequireRealmRuleAcknowledgement(
	trigger: RealmRuleTrigger,
	rules: { requireOnPost: boolean; requireOnUpdate: boolean },
) {
	return trigger === "post" ? rules.requireOnPost : rules.requireOnUpdate;
}

const RealmRoles = ["member", "moderator", "admin", "owner"] as const;
export type RealmRole = (typeof RealmRoles)[number];

const roleRank: Record<RealmRole, number> = {
	member: 0,
	moderator: 1,
	admin: 2,
	owner: 3,
};

const realmRoleCapabilities: Record<RealmRole, readonly RealmCapability[]> = {
	member: ["realm.contribute"],
	moderator: [
		"realm.contribute",
		"realm.members.read",
		"realm.members.manage",
		"realm.pins.manage",
		"realm.units.moderate",
	],
	admin: [
		"realm.contribute",
		"realm.settings.update",
		"realm.members.read",
		"realm.members.manage",
		"realm.rules.publish",
		"realm.pins.manage",
		"realm.units.moderate",
	],
	owner: RealmCapabilityValues,
};

function isRealmRole(role: string): role is RealmRole {
	return RealmRoles.some((candidate) => candidate === role);
}

export function canRealmRolePerform(role: string, capability: RealmCapability) {
	return isRealmRole(role) && realmRoleCapabilities[role].includes(capability);
}

export function canManageRealmMember(actorRole: string, targetRole: string, nextRole?: string) {
	if (!isRealmRole(actorRole) || !isRealmRole(targetRole)) return false;
	if (roleRank[actorRole] <= roleRank[targetRole]) return false;
	return !nextRole || (isRealmRole(nextRole) && roleRank[nextRole] < roleRank[actorRole]);
}
