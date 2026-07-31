import type { GetApiRealmsByRealmIdTaxonomyDraftStatus200 } from "@rezics/openapi-tanstack-query";

type RealmTaxonomyItem = GetApiRealmsByRealmIdTaxonomyDraftStatus200["items"][number];

export interface RealmPolicyTagCandidate {
	readonly avatar: RealmTaxonomyItem["avatar"];
	readonly id: string;
	readonly kind: "tag";
	readonly label: string;
}

export function realmPolicyTagCandidates(
	items: readonly RealmTaxonomyItem[],
	targetUnitId: string,
	unnamedTag: string,
): readonly RealmPolicyTagCandidate[] {
	return items.flatMap((item) =>
		item.contentKind === "tag" &&
		item.queryStrategy === "realm_policy" &&
		item.contentUnitId !== targetUnitId
			? [
					{
						id: item.contentUnitId,
						label: item.title ?? unnamedTag,
						kind: "tag",
						avatar: item.avatar,
					} satisfies RealmPolicyTagCandidate,
				]
			: [],
	);
}
