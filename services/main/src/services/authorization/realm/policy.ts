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
