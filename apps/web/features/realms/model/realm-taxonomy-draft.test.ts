import { describe, expect, it } from "vitest";

import {
	createRealmTaxonomyDraft,
	createRealmTaxonomyLabel,
	realmTaxonomyDraftFingerprint,
	realmTaxonomyDraftIsValid,
	toRealmTaxonomySaveNodes,
} from "./realm-taxonomy-draft";

describe("Realm taxonomy draft", () => {
	it("derives contiguous sibling order from persisted fractional positions", () => {
		const draft = createRealmTaxonomyDraft({
			structureId: "10000000-0000-4000-8000-000000000000",
			latestRevisionId: "20000000-0000-4000-8000-000000000000",
			items: [
				{
					id: "a",
					parentId: null,
					contentUnitId: "30000000-0000-4000-8000-000000000000",
					contentKind: "label",
					language: "en",
					title: "Second",
					summary: null,
					avatar: null,
					position: "b0",
					queryStrategy: null,
					contextPostId: null,
					contextSummary: null,
				},
				{
					id: "b",
					parentId: null,
					contentUnitId: "40000000-0000-4000-8000-000000000000",
					contentKind: "tag",
					language: "en",
					title: "First",
					summary: null,
					avatar: null,
					position: "a0",
					queryStrategy: "global_effective",
					contextPostId: null,
					contextSummary: null,
				},
			],
		});

		expect(draft.map(({ id, order }) => [id, order])).toEqual([
			["a", 1],
			["b", 0],
		]);
	});

	it("serializes inline labels and ignores presentation-only fields", () => {
		const node = createRealmTaxonomyLabel({
			id: "10000000-0000-4000-8000-000000000000",
			language: "zh",
			order: 0,
			parentId: null,
			title: "  類別  ",
		});

		expect(toRealmTaxonomySaveNodes([node])).toEqual([
			{
				state: "new",
				id: node.id,
				parentId: null,
				order: 0,
				queryStrategy: null,
				content: { kind: "label", language: "zh", title: "類別" },
			},
		]);
		expect(realmTaxonomyDraftIsValid([node])).toBe(true);
		expect(realmTaxonomyDraftFingerprint([node])).toBe(
			JSON.stringify(toRealmTaxonomySaveNodes([node])),
		);
	});
});
