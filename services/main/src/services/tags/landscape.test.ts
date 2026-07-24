import { describe, expect, it } from "vitest";

import { selectPopulatedRealmTagSources } from "./landscape";

describe("selectPopulatedRealmTagSources", () => {
	it("applies the limit after skipping empty sources and preserves source order", () => {
		const sources = ["empty-a", "realm-a", "empty-b", "realm-b", "realm-c"].map((realmId) => ({
			realmId,
		}));
		const selected = selectPopulatedRealmTagSources({
			sources,
			votedTags: new Map([
				["realm-a", [{ tagId: "tag-a" }]],
				["realm-c", [{ tagId: "tag-c" }]],
			]),
			policyTags: new Map([["realm-b", [{ tagId: "tag-b" }]]]),
			limit: 2,
		});
		expect(selected.map(({ realmId }) => realmId)).toEqual(["realm-a", "realm-b"]);
	});
});
