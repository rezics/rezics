import type { GetApiRealmsByRealmIdTaxonomyStatus200 } from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { realmPolicyTagCandidates } from "./realm-policy-tags";

type TaxonomyItem = GetApiRealmsByRealmIdTaxonomyStatus200["items"][number];

function taxonomyItem(
	id: string,
	contentKind: TaxonomyItem["contentKind"],
	queryStrategy: TaxonomyItem["queryStrategy"],
	title: string | null = id,
): TaxonomyItem {
	return {
		id: `019fa3ab-72a9-7792-b2e3-43aa8a9c${id.padStart(4, "0")}`,
		parentId: null,
		contentUnitId: `019fa3ab-72a9-7792-b2e3-43aa8a9d${id.padStart(4, "0")}`,
		contentKind,
		language: "zh",
		title,
		summary: null,
		avatar: null,
		position: `a${id}`,
		queryStrategy,
		contextPostId: null,
		contextSummary: null,
	};
}

describe("Realm policy Tag candidates", () => {
	it("keeps only policy-authority Tags that can be applied to the target", () => {
		const policy = taxonomyItem("1", "tag", "realm_policy", "政策標籤");
		const self = taxonomyItem("2", "tag", "realm_policy", "內容自己");
		const unnamed = taxonomyItem("3", "tag", "realm_policy", null);
		const candidates = realmPolicyTagCandidates(
			[
				policy,
				self,
				unnamed,
				taxonomyItem("4", "tag", "global_effective"),
				taxonomyItem("5", "tag", "realm_community"),
				taxonomyItem("6", "label", null),
			],
			self.contentUnitId,
			"未命名標籤",
		);

		expect(candidates).toEqual([
			{
				id: policy.contentUnitId,
				label: "政策標籤",
				kind: "tag",
				avatar: null,
			},
			{
				id: unnamed.contentUnitId,
				label: "未命名標籤",
				kind: "tag",
				avatar: null,
			},
		]);
	});
});
