import { describe, expect, it } from "vitest";

import {
	isPublicationLicenseId,
	parseNullablePublicationLicenseId,
	PublicationLicenseIds,
	PublicationLicenseRegistry,
} from ".";

describe("publication License registry", () => {
	it("preserves the product preference order", () => {
		expect(PublicationLicenseIds).toEqual([
			"cc-by-nc-sa-4.0",
			"cc-by-sa-4.0",
			"all-rights-reserved",
			"cc-by-nc-4.0",
			"cc-by-4.0",
			"cc0-1.0",
		]);
	});

	it("maps every ID to a matching definition", () => {
		for (const id of PublicationLicenseIds) expect(PublicationLicenseRegistry[id].id).toBe(id);
	});

	it("keeps canonical License URLs independent of presentation locale", () => {
		for (const definition of Object.values(PublicationLicenseRegistry)) {
			if (definition.kind !== "license") continue;
			expect(() => new URL(definition.url)).not.toThrow();
			expect(definition.url).not.toContain("/deed.");
		}
	});

	it("accepts only registered IDs", () => {
		expect(isPublicationLicenseId("cc-by-4.0")).toBe(true);
		expect(isPublicationLicenseId("CC-BY-4.0")).toBe(false);
		expect(isPublicationLicenseId("unknown")).toBe(false);
		expect(() => parseNullablePublicationLicenseId("unknown")).toThrow();
		expect(parseNullablePublicationLicenseId(null)).toBeNull();
	});
});
