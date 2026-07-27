import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { GetApiRealmsByRealmIdMembersStatus200 } from "@rezics/openapi-tanstack-query";

export const MemberStates = ["active", "pending", "muted", "removed", "banned"] as const;

export type MemberState = (typeof MemberStates)[number];
export type RealmMember = GetApiRealmsByRealmIdMembersStatus200["items"][number];
export type MemberFilter<Value extends string> = Value | "all";

export function isMemberState(value: string): value is MemberState {
	return MemberStates.some((state) => state === value);
}

function normalizedSearchValue(value: string): string {
	return value.trim().toLocaleLowerCase();
}

export function filterRealmMembers(
	members: readonly RealmMember[],
	search: string,
	state: MemberFilter<MemberState>,
): RealmMember[] {
	const query = normalizedSearchValue(search);
	return members.filter((member) => {
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
