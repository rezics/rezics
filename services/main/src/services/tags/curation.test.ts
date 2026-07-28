import { describe, expect, it } from "vitest";

import {
	nextUnitTagCurationUpdatedAt,
	readUnitTagCurationState,
	unitTagCurationOrdersEqual,
	unitTagCurationStatesEqual,
} from "./curation";

describe("Unit Tag curation", () => {
	it("accepts exactly the two persisted curation states", () => {
		expect(readUnitTagCurationState({ pinned: true, position: "a0" })).toEqual({
			pinned: true,
			position: "a0",
		});
		expect(readUnitTagCurationState({ pinned: false, position: null })).toEqual({
			pinned: false,
			position: null,
		});
		expect(() => readUnitTagCurationState({ pinned: true, position: null })).toThrow(
			"Pinned Unit Tag is missing its position",
		);
		expect(() => readUnitTagCurationState({ pinned: false, position: "a0" })).toThrow(
			"Unpinned Unit Tag unexpectedly has a position",
		);
	});

	it("compares both the pin state and ordered position", () => {
		expect(
			unitTagCurationStatesEqual(
				{ pinned: true, position: "a0" },
				{ pinned: true, position: "a0" },
			),
		).toBe(true);
		expect(
			unitTagCurationStatesEqual(
				{ pinned: true, position: "a0" },
				{ pinned: true, position: "a1" },
			),
		).toBe(false);
		expect(
			unitTagCurationStatesEqual(
				{ pinned: false, position: null },
				{ pinned: true, position: "a0" },
			),
		).toBe(false);
	});

	it("compares the complete featured Tag order", () => {
		expect(unitTagCurationOrdersEqual(["tag-a", "tag-b"], ["tag-a", "tag-b"])).toBe(true);
		expect(unitTagCurationOrdersEqual(["tag-a", "tag-b"], ["tag-b", "tag-a"])).toBe(false);
		expect(unitTagCurationOrdersEqual(["tag-a"], ["tag-a", "tag-b"])).toBe(false);
	});

	it("advances the optimistic-concurrency token even within one millisecond", () => {
		const current = new Date("2026-07-28T12:00:00.100Z");
		expect(nextUnitTagCurationUpdatedAt(current, current.getTime())).toEqual(
			new Date("2026-07-28T12:00:00.101Z"),
		);
		expect(nextUnitTagCurationUpdatedAt(current, current.getTime() + 10)).toEqual(
			new Date("2026-07-28T12:00:00.110Z"),
		);
	});
});
