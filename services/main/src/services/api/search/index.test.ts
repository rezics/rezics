import type { BlockPath, SearchFeatureSource, UnitReferencedBlock } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { findFeedBlock, findSearchFeatureSource } from "./block-source";

const BlockKey = "000000000001";
const Path = [{ slot: "blocks", key: BlockKey }] satisfies BlockPath;

function document(block: UnitReferencedBlock) {
	return { blocks: [block] };
}

describe("Zone Block Search source resolution", () => {
	it("resolves search-backed UnitList through one trusted path", () => {
		const feature: SearchFeatureSource = {
			kind: "inline",
			filterDocument: { categories: ["units"], where: { kind: { in: ["book"] } } },
		};
		expect(
			findSearchFeatureSource(
				document({
					_type: "unit-list",
					_key: BlockKey,
					source: { kind: "search", feature },
					layout: "grid",
					limit: 12,
				}),
				Path,
			),
		).toEqual(feature);
	});

	it("resolves only a Feed block through the Feed execution path", () => {
		const feature = { kind: "global" } as const;
		expect(
			findFeedBlock(
				document({
					_type: "feed",
					_key: BlockKey,
					feature,
					presentation: {
						pagination: "load-more",
						showResultCount: false,
					},
				}),
				Path,
			),
		).toMatchObject({ _type: "feed", feature });
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
				Path,
			),
		).toThrow("does not use Search Feature");
	});
});
