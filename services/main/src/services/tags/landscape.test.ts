import { describe, expect, it } from "vitest";

import { selectRealmTagSources } from "./landscape";

describe("selectRealmTagSources", () => {
	it("keeps only voted sources, then applies source order, limits, and exact vote permission", () => {
		const sources = ["empty-a", "realm-a", "empty-b", "realm-b"].map((realmId) => ({
			realmId,
		}));
		const selected = selectRealmTagSources({
			sources,
			votedTags: new Map([
				["realm-a", [{ tagId: "tag-a" }]],
				["empty-b", []],
				["realm-b", [{ tagId: "tag-b" }]],
			]),
			canVoteRealmIds: new Set(["realm-b"]),
			limit: 2,
		});
		expect(selected).toEqual([
			{ realmId: "realm-a", canVote: false, votedTags: [{ tagId: "tag-a" }] },
			{ realmId: "realm-b", canVote: true, votedTags: [{ tagId: "tag-b" }] },
		]);
	});
});
