import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { GetApiRealmsByRealmIdMembersStatus200 } from "@rezics/openapi-tanstack-query";

export const MemberRoles = ["owner", "admin", "moderator", "member"] as const;
export const MemberStates = ["active", "pending", "muted", "removed", "banned"] as const;

export type MemberRole = (typeof MemberRoles)[number];
export type MemberState = (typeof MemberStates)[number];
export type RealmMember = GetApiRealmsByRealmIdMembersStatus200["items"][number];
export type MemberFilter<Value extends string> = Value | "all";

export function isMemberRole(value: string): value is MemberRole {
	return MemberRoles.some((role) => role === value);
}

export function isMemberState(value: string): value is MemberState {
	return MemberStates.some((state) => state === value);
}

function normalizedSearchValue(value: string): string {
	return value.trim().toLocaleLowerCase();
}

export function filterRealmMembers(
	members: readonly RealmMember[],
	search: string,
	role: MemberFilter<MemberRole>,
	state: MemberFilter<MemberState>,
): RealmMember[] {
	const query = normalizedSearchValue(search);
	return members.filter((member) => {
		if (role !== "all" && member.role !== role) return false;
		if (state !== "all" && member.state !== state) return false;
		if (!query) return true;
		const slug = member.slugAddress?.slug;
		return [
			member.name,
			slug,
			slug ? `${verbatimTerms.profileSlugPrefix.value}${slug}` : undefined,
			member.profileId,
		].some((value) => value?.toLocaleLowerCase().includes(query));
	});
}
