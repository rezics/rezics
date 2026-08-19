import { describe, expect, it } from "vitest";

import { LicenseRegistry, RecommendedLicenseId } from "@rezics/license";

import { UnitLicenseGrantForbidden, UnitLicenseNotApplicable } from "./errors";

describe("independent license offerings", () => {
	it("accepts residual rights together with any other registered license", () => {
		expect(LicenseRegistry["all-rights-reserved"].ownerMayEndOffering).toBe(true);
		expect(LicenseRegistry["cc-by-4.0"].ownerMayEndOffering).toBe(true);
		expect(LicenseRegistry[RecommendedLicenseId].ownerMayEndOffering).toBe(true);
		expect(LicenseRegistry["cc0-1.0"].applicableUnitKinds).toBeNull();
		expect(LicenseRegistry["pdm-1.0"].applicableUnitKinds).toBeNull();
		expect(LicenseRegistry[RecommendedLicenseId].applicableUnitKinds).toBeNull();
	});

	it("keeps grantor and applicability failures typed", () => {
		expect(new UnitLicenseGrantForbidden()).toBeInstanceOf(UnitLicenseGrantForbidden);
		expect(new UnitLicenseNotApplicable("cc-by-4.0", "realm").details).toEqual({
			licenseId: "cc-by-4.0",
			unitKind: "realm",
		});
	});
});
