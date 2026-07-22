import { describe, expect, it } from "vitest";

import { apiTokenOperationCostUnits, apiTokenOperationId } from "./operation";

describe("API token operation identity", () => {
	it("derives stable operation IDs from the matched route template", () => {
		expect(apiTokenOperationId("GET", "/api/units/:unitId")).toBe("getApiUnitsByUnitId");
		expect(apiTokenOperationId("PATCH", "/api/units/:unitId?")).toBe(
			"patchApiUnitsByUnitIdOptional",
		);
	});

	it("charges explicit expensive operations and defaults other operations to one unit", () => {
		expect(apiTokenOperationCostUnits("postApiSearchExecute")).toBe(5);
		expect(apiTokenOperationCostUnits("postApiImage-assets")).toBe(10);
		expect(apiTokenOperationCostUnits("getApiUnits")).toBe(1);
	});
});
