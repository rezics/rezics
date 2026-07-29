import { describe, expect, it } from "vitest";

import {
	createWikiNavigationDraft,
	toWikiNavigationDocument,
	wikiNavigationDraftIsValid,
} from "./wiki-navigation-draft";

describe("Wiki navigation draft", () => {
	it("round trips a nested Wiki-only navigation document", () => {
		const document = {
			_type: "navigation-document" as const,
			_key: "000000000001",
			items: [
				{
					_key: "000000000002",
					labelUnitId: "10000000-0000-4000-8000-000000000000",
					children: [
						{
							_key: "000000000003",
							labelUnitId: "20000000-0000-4000-8000-000000000000",
							target: {
								kind: "unit" as const,
								unitId: "30000000-0000-4000-8000-000000000000",
							},
						},
					],
				},
			],
		};
		const draft = createWikiNavigationDraft(document);

		expect(wikiNavigationDraftIsValid(draft)).toBe(true);
		expect(toWikiNavigationDocument(draft, document._key)).toEqual(document);
	});

	it("rejects empty groups and links without a target", () => {
		expect(
			wikiNavigationDraftIsValid([
				{
					id: "000000000002",
					parentId: null,
					order: 0,
					labelUnitId: "10000000-0000-4000-8000-000000000000",
					kind: "group",
				},
			]),
		).toBe(false);
		expect(
			wikiNavigationDraftIsValid([
				{
					id: "000000000002",
					parentId: null,
					order: 0,
					labelUnitId: "10000000-0000-4000-8000-000000000000",
					kind: "link",
					targetUnitId: "",
				},
			]),
		).toBe(false);
	});
});
