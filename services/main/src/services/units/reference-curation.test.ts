import { describe, expect, it } from "vitest";

import {
	readUnitReferenceCurationState,
	unitReferenceCurationStatesEqual,
} from "./reference-curation";

describe("Unit reference curation", () => {
	it("accepts exactly the two persisted pin states", () => {
		expect(readUnitReferenceCurationState({ pinned: true, position: "a0" })).toEqual({
			pinned: true,
			position: "a0",
		});
		expect(readUnitReferenceCurationState({ pinned: false, position: null })).toEqual({
			pinned: false,
			position: null,
		});
		expect(() => readUnitReferenceCurationState({ pinned: true, position: null })).toThrow(
			"Pinned reference is missing its position",
		);
		expect(() => readUnitReferenceCurationState({ pinned: false, position: "a0" })).toThrow(
			"Unpinned reference unexpectedly has a position",
		);
	});

	it("compares both the pin state and ordered position", () => {
		expect(
			unitReferenceCurationStatesEqual(
				{ pinned: true, position: "a0" },
				{ pinned: true, position: "a0" },
			),
		).toBe(true);
		expect(
			unitReferenceCurationStatesEqual(
				{ pinned: true, position: "a0" },
				{ pinned: true, position: "a1" },
			),
		).toBe(false);
		expect(
			unitReferenceCurationStatesEqual(
				{ pinned: false, position: null },
				{ pinned: true, position: "a0" },
			),
		).toBe(false);
	});
});
