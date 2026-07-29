import { describe, expect, it } from "vitest";

import { ResourceVisibilityValues } from "../database/schema/contract-values";
import { toUnitVisibilityUpdate } from "./visibility-update";

describe("Unit visibility update", () => {
	it("represents an omitted partial update without an empty database update", () => {
		expect(toUnitVisibilityUpdate(undefined)).toBeUndefined();
	});

	it.each(ResourceVisibilityValues)("preserves the explicit %s visibility", (visibility) => {
		expect(toUnitVisibilityUpdate(visibility)).toEqual({ visibility });
	});
});
