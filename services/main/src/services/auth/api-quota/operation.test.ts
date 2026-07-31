import { describe, expect, it } from "vitest";

import {
	ApiQuotaOperationDefinitions,
	apiRouteOperationId,
	resolveApiQuotaOperation,
	resolveApiQuotaOperationById,
} from "./operation";

describe("API quota operation identity", () => {
	it("derives the route operation ID used to select a stable quota scope", () => {
		expect(apiRouteOperationId("GET", "/api/units/:unitId")).toBe("getApiUnitsByUnitId");
		expect(apiRouteOperationId("PATCH", "/api/units/:unitId?")).toBe(
			"patchApiUnitsByUnitIdOptional",
		);
	});

	it("groups route operations under stable quota operations", () => {
		expect(resolveApiQuotaOperation("postApiSearch")).toEqual({
			scope: "search.execute",
			costUnits: 5,
		});
		expect(resolveApiQuotaOperation("postApiSearchFeaturesByTemplateFeed")).toEqual({
			scope: "search.execute",
			costUnits: 5,
		});
		expect(
			resolveApiQuotaOperation(
				"postApiSearchZonesByZoneIdPagesByPageIdBlocksByBlockKeyExecute",
			),
		).toEqual({ scope: "search.execute", costUnits: 5 });
		expect(resolveApiQuotaOperation("postApiImage-assets")).toEqual({
			scope: "image.upload",
			costUnits: 10,
		});
	});

	it("uses the global unit cost for operations without a dedicated scope", () => {
		expect(resolveApiQuotaOperation("getApiUnits")).toEqual({
			scope: null,
			costUnits: 1,
		});
	});

	it("resolves a semantic operation directly for public routes", () => {
		expect(resolveApiQuotaOperationById("search.execute")).toEqual({
			scope: "search.execute",
			costUnits: 5,
		});
	});

	it("keeps operation definitions unique and positive", () => {
		expect(new Set(ApiQuotaOperationDefinitions.map(({ id }) => id)).size).toBe(
			ApiQuotaOperationDefinitions.length,
		);
		expect(ApiQuotaOperationDefinitions.every(({ costUnits }) => costUnits > 0)).toBe(true);
	});
});
