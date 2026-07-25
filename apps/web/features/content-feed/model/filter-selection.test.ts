import { describe, expect, it } from "vitest";

import { filterSelectionFromValues, filterSelectionValues } from "./filter-selection";

describe("FilterSelection", () => {
	it("represents an empty selection as an unconstrained all query", () => {
		const selection = filterSelectionFromValues<string>([]);
		expect(selection).toEqual({ mode: "all" });
		expect(filterSelectionValues(selection, ["post", "review"])).toEqual(["post", "review"]);
	});

	it("proves only selections are non-empty", () => {
		expect(filterSelectionFromValues(["review"])).toEqual({
			mode: "only",
			values: ["review"],
		});
	});
});
