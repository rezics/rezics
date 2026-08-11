import { describe, expect, it } from "vitest";

import { getRequestedUnitLandingLanguage } from "./unit-landing-search-params.server";

describe("Unit landing language search parameter", () => {
	it("accepts an explicit content language", async () => {
		await expect(
			getRequestedUnitLandingLanguage(Promise.resolve({ language: "ja" })),
		).resolves.toBe("ja");
	});

	it("does not strengthen an invalid external value into a content language", async () => {
		await expect(
			getRequestedUnitLandingLanguage(Promise.resolve({ language: "zh-Hant" })),
		).resolves.toBeUndefined();
	});

	it("leaves an omitted language unspecified", async () => {
		await expect(getRequestedUnitLandingLanguage(Promise.resolve({}))).resolves.toBeUndefined();
	});
});
