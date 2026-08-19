import { describe, expect, it } from "vitest";

import {
	isLicenseId,
	LicenseIds,
	LicenseLegalFormValues,
	LicenseRecognitionStatusValues,
	LicenseRegistry,
	parseLicenseId,
	parseNullableLicenseId,
	RecommendedLicenseId,
	ResidualRightsLicenseId,
	rezicsLicenseTermsUrl,
} from ".";

describe("License registry", () => {
	it("preserves the product order and maps every ID to one complete definition", () => {
		expect(LicenseIds).toEqual([
			"cc-by-nc-sa-4.0",
			"cc-by-sa-4.0",
			"cc-by-sa-3.0",
			"all-rights-reserved",
			"cc-by-nc-4.0",
			"cc-by-4.0",
			"cc0-1.0",
			"pdm-1.0",
			"rezics-unit-content-license-v1",
		]);
		for (const id of LicenseIds) {
			const definition = LicenseRegistry[id];
			expect(definition.id).toBe(id);
			expect(LicenseLegalFormValues).toContain(definition.legalForm);
			expect(typeof definition.ownerMayEndOffering).toBe("boolean");
			expect(typeof definition.requiresAffirmativeAcknowledgement).toBe("boolean");
			expect(definition.applicableUnitKinds).toBeNull();
		}
	});

	it("keeps canonical terms URLs independent of presentation locale", () => {
		for (const definition of Object.values(LicenseRegistry)) {
			if (definition.termsUrl === null) continue;
			expect(() => new URL(definition.termsUrl)).not.toThrow();
			expect(definition.termsUrl).not.toContain("/deed.");
		}
		expect(LicenseRegistry[RecommendedLicenseId].termsUrl).toBe(
			rezicsLicenseTermsUrl(RecommendedLicenseId),
		);
		expect(LicenseRegistry[ResidualRightsLicenseId].termsUrl).toBeNull();
	});

	it("accepts only registered IDs", () => {
		expect(isLicenseId("cc-by-4.0")).toBe(true);
		expect(isLicenseId(RecommendedLicenseId)).toBe(true);
		expect(isLicenseId("CC-BY-4.0")).toBe(false);
		expect(isLicenseId("unknown")).toBe(false);
		expect(parseLicenseId("cc0-1.0")).toBe("cc0-1.0");
		expect(() => parseLicenseId("unknown")).toThrow("Unknown License ID");
		expect(parseNullableLicenseId(null)).toBeNull();
		expect(() => parseNullableLicenseId("unknown")).toThrow("Unknown License ID");
	});

	it("keeps every License independently grantable", () => {
		for (const id of LicenseIds) {
			expect(LicenseRegistry[id].ownerMayEndOffering).toBe(true);
			expect(LicenseRegistry[id].applicableUnitKinds).toBeNull();
			expect(Object.hasOwn(LicenseRegistry[id], "exclusive")).toBe(false);
			expect(Object.hasOwn(LicenseRegistry[id], "singletonFamily")).toBe(false);
		}
		expect(LicenseRegistry[RecommendedLicenseId].requiresAffirmativeAcknowledgement).toBe(true);
		expect(LicenseRegistry["cc-by-4.0"].requiresAffirmativeAcknowledgement).toBe(false);
		expect(LicenseRegistry["pdm-1.0"].legalForm).toBe("public-domain-mark");
		expect(LicenseRegistry["pdm-1.0"].termsUrl).toBe(
			"https://creativecommons.org/publicdomain/mark/1.0/",
		);
	});

	it("exposes recognition statuses without selection semantics", () => {
		expect(LicenseRecognitionStatusValues).toEqual(["recognized", "invalidated"]);
	});
});
