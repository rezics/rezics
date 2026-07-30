import { describe, expect, it } from "vitest";

import { selectRealmTagSources } from "./landscape";

describe("selectRealmTagSources", () => {
	it("preserves empty subscribed sources, source order, limits, and exact vote permission", () => {
		const sources = ["empty-a", "realm-a", "empty-b", "realm-b"].map((realmId) => ({
			realmId,
		}));
		const selected = selectRealmTagSources({
			sources,
			votedTags: new Map([["realm-a", [{ tagId: "tag-a" }]]]),
			canVoteRealmIds: new Set(["realm-a", "realm-b"]),
			limit: 3,
		});
		expect(selected).toEqual([
			{ realmId: "empty-a", canVote: false, votedTags: [] },
			{ realmId: "realm-a", canVote: true, votedTags: [{ tagId: "tag-a" }] },
			{ realmId: "empty-b", canVote: false, votedTags: [] },
		]);
	});
});
