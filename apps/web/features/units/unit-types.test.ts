import { describe, expect, it } from "vitest";

import { isUnitType } from "./unit-types";

describe("Unit type routing", () => {
	it("accepts Release through the generic Unit route guard", () => {
		expect(isUnitType("release")).toBe(true);
	});
});
