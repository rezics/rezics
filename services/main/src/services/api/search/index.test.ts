import type { Block } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { findSearchFeatureSource } from "./block-source";

const BlockKey = "seed-search-block";

function document(block: Block) {
	return { blocks: [block] };
}

describe("Zone Block Search source resolution", () => {
	it("resolves Search, Feed, and search-backed UnitList through one trusted path", () => {
		const feature = { kind: "template", template: "book" } as const;
		expect(
			findSearchFeatureSource(
				document({
					_type: "search",
					_key: BlockKey,
					feature,
					presentation: { results: "grid", showResultCount: true },
				}),
				BlockKey,
			),
		).toEqual(feature);
		expect(
			findSearchFeatureSource(
				document({
					_type: "feed",
					_key: BlockKey,
					feature,
					presentation: {
						results: "grid",
						pagination: "load-more",
						showResultCount: false,
					},
				}),
				BlockKey,
			),
		).toEqual(feature);
		expect(
			findSearchFeatureSource(
				document({
					_type: "unit-list",
					_key: BlockKey,
					source: { kind: "search", feature },
					layout: "grid",
					limit: 12,
				}),
				BlockKey,
			),
		).toEqual(feature);
	});

	it("rejects static and collection-backed UnitLists", () => {
		expect(() =>
			findSearchFeatureSource(
				document({
					_type: "unit-list",
					_key: BlockKey,
					source: {
						kind: "units",
						unitIds: ["00000000-0000-7000-8000-000000000001"],
					},
					layout: "list",
					limit: 10,
				}),
				BlockKey,
			),
		).toThrow("does not use Search Feature");
	});
});
