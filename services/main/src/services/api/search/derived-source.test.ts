import type { BlockPath, DerivedSearchFeatureSource } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { deriveDerivedSelectionSeed, selectDerivedCandidate } from "./derived-source";

const CollectionId = "019b0000-0000-7000-8000-000000000001";
const PageId = "019b0000-0000-7000-8000-000000000002";
const ZoneId = "019b0000-0000-7000-8000-000000000003";
const Path: BlockPath = [{ slot: "blocks", key: "100000000001" }];

function source(seed: DerivedSearchFeatureSource["select"]["seed"]): DerivedSearchFeatureSource {
	return {
		kind: "derived",
		select: {
			kind: "random-tag",
			from: { kind: "collection", collectionId: CollectionId },
			seed,
		},
		query: { feature: { kind: "global" } },
		fallback: { kind: "hide" },
	};
}

describe("derived Zone source selection", () => {
	it("is stable within a time bucket for one runtime resource and BlockPath", () => {
		const first = deriveDerivedSelectionSeed(
			source({ kind: "time-bucket", hours: 6 }),
			{ kind: "page", pageId: PageId },
			Path,
			undefined,
			new Date("2026-08-26T01:00:00.000Z"),
		);
		const second = deriveDerivedSelectionSeed(
			source({ kind: "time-bucket", hours: 6 }),
			{ kind: "page", pageId: PageId },
			Path,
			undefined,
			new Date("2026-08-26T05:59:59.999Z"),
		);

		expect(second).toEqual(first);
		expect(first.continuationSeed).toMatch(/^bucket:\d+$/);
	});

	it("uses runtime Page or Dock context without injecting identity into persisted JSON", () => {
		const derived = source({ kind: "time-bucket", hours: 24 });
		const now = new Date("2026-08-26T12:00:00.000Z");
		const pageSeed = deriveDerivedSelectionSeed(
			derived,
			{ kind: "page", pageId: PageId },
			Path,
			"continuation-a",
			now,
		);
		const dockSeed = deriveDerivedSelectionSeed(
			derived,
			{ kind: "dock", zoneId: ZoneId, slot: "main" },
			Path,
			"continuation-a",
			now,
		);

		expect(pageSeed.continuationSeed).toBe("continuation-a");
		expect(dockSeed.continuationSeed).toBe("continuation-a");
		expect(dockSeed.hashSeed).not.toBe(pageSeed.hashSeed);
	});

	it("honors a continuation seed across time and selects a candidate deterministically", () => {
		const derived = source({ kind: "request" });
		const first = deriveDerivedSelectionSeed(
			derived,
			{ kind: "page", pageId: PageId },
			Path,
			"request-seed",
			new Date("2026-08-26T00:00:00.000Z"),
		);
		const second = deriveDerivedSelectionSeed(
			derived,
			{ kind: "page", pageId: PageId },
			Path,
			"request-seed",
			new Date("2027-08-26T00:00:00.000Z"),
		);
		const candidates = [
			"019b0000-0000-7000-8000-000000000011",
			"019b0000-0000-7000-8000-000000000012",
			"019b0000-0000-7000-8000-000000000013",
		];

		expect(second).toEqual(first);
		expect(selectDerivedCandidate(candidates, first.hashSeed)).toBe(
			selectDerivedCandidate(candidates, second.hashSeed),
		);
		expect(selectDerivedCandidate([], first.hashSeed)).toBeUndefined();
	});
});
