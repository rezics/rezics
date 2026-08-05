import { describe, expect, it } from "vitest";

import { nextPinnedReferencePosition, positionForPinnedReferenceMove } from "./reference-curation";

const candidates = [
	{ id: "first", pinned: true, position: "a0" },
	{ id: "second", pinned: true, position: "a1" },
	{ id: "ranked", pinned: false, position: null },
] as const;

describe("reference curation positions", () => {
	it("appends after the current curated group", () => {
		expect(nextPinnedReferencePosition(candidates) > "a1").toBe(true);
	});

	it("places moves strictly between their new neighbors", () => {
		const movedFirst = positionForPinnedReferenceMove(candidates, "second", 0);
		expect(movedFirst).not.toBeNull();
		expect(movedFirst! < "a0").toBe(true);

		const movedLast = positionForPinnedReferenceMove(candidates, "first", 1);
		expect(movedLast).not.toBeNull();
		expect(movedLast! > "a1").toBe(true);
	});

	it("rejects unknown candidates and out-of-range targets", () => {
		expect(positionForPinnedReferenceMove(candidates, "missing", 0)).toBeNull();
		expect(positionForPinnedReferenceMove(candidates, "first", 2)).toBeNull();
	});
});
