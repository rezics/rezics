import { describe, expect, it } from "vitest";

import { parseZonePageAggregateResponse } from "./zone-page-aggregate";

const RevisionId = "019b0000-0000-7000-8000-000000000001";
const UnitId = "019b0000-0000-7000-8000-000000000002";
const Path = [{ slot: "blocks", key: "100000000001" }] as const;

function searchOutcome() {
	return {
		kind: "ok",
		blockType: "unit-list",
		itemKind: "search-hit",
		items: [
			{
				id: UnitId,
				category: "unit",
				kind: "book",
				title: "Book",
				name: null,
				summary: null,
			},
		],
		total: { kind: "exact", value: 1 },
	} as const;
}

describe("Zone Page aggregate response parsing", () => {
	it("keeps identical local paths independent across Page and Dock surfaces", () => {
		const parsed = parseZonePageAggregateResponse({
			pageRevision: RevisionId,
			page: { results: [{ path: Path, outcome: searchOutcome() }] },
			dock: {
				results: [{ path: Path, outcome: { kind: "skipped", reason: "budget" } }],
			},
		});

		expect(parsed.page.results[0]?.outcome.kind).toBe("ok");
		expect(parsed.dock?.results[0]?.outcome).toEqual({
			kind: "skipped",
			reason: "budget",
		});
	});

	it("rejects duplicate paths only within one surface", () => {
		expect(() =>
			parseZonePageAggregateResponse({
				pageRevision: RevisionId,
				page: {
					results: [
						{ path: Path, outcome: { kind: "hidden" } },
						{ path: Path, outcome: { kind: "hidden" } },
					],
				},
			}),
		).toThrow("duplicate Block paths");
	});

	it("rejects invalid selected-Unit languages at the network boundary", () => {
		expect(() =>
			parseZonePageAggregateResponse({
				pageRevision: RevisionId,
				page: {
					results: [
						{
							path: Path,
							outcome: {
								...searchOutcome(),
								selected: {
									id: UnitId,
									kind: "tag",
									language: "not-a-language",
									title: "Tag",
									summary: null,
									avatar: null,
								},
							},
						},
					],
				},
			}),
		).toThrow("invalid selected Unit");
	});

	it("rejects item pages above the eager response bound", () => {
		expect(() =>
			parseZonePageAggregateResponse({
				pageRevision: RevisionId,
				page: {
					results: [
						{
							path: Path,
							outcome: {
								...searchOutcome(),
								items: Array.from({ length: 21 }, () => searchOutcome().items[0]),
							},
						},
					],
				},
			}),
		).toThrow("invalid item page");
	});

	it("rejects a feed discriminator paired with Search hits", () => {
		expect(() =>
			parseZonePageAggregateResponse({
				pageRevision: RevisionId,
				page: {
					results: [
						{
							path: Path,
							outcome: {
								...searchOutcome(),
								blockType: "feed",
							},
						},
					],
				},
			}),
		).toThrow("invalid Search items");
	});
});
