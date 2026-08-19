import { describe, expect, it } from "vitest";

import { readSubmittedLicenses, reconcileLicenseSelection } from "../model/unit-licenses";

describe("reconcileLicenseSelection", () => {
	it("preserves a stored ARR and CC combination", () => {
		expect(
			reconcileLicenseSelection({
				initial: ["all-rights-reserved", "cc-by-4.0"],
				next: ["all-rights-reserved", "cc-by-4.0", "cc0-1.0"],
				previous: ["all-rights-reserved", "cc-by-4.0"],
			}),
		).toEqual(["all-rights-reserved", "cc-by-4.0", "cc0-1.0"]);
	});

	it("allows the REZICS License to be removed from any Unit ownership mode", () => {
		expect(
			reconcileLicenseSelection({
				initial: ["rezics-unit-content-license-v1-1", "cc-by-4.0"],
				next: ["cc-by-4.0"],
				previous: ["rezics-unit-content-license-v1-1", "cc-by-4.0"],
			}),
		).toEqual(["cc-by-4.0"]);
	});

	it("applies ARR simplification only when ARR is newly selected", () => {
		expect(
			reconcileLicenseSelection({
				initial: [],
				next: ["cc-by-4.0", "all-rights-reserved"],
				previous: ["cc-by-4.0"],
			}),
		).toEqual(["all-rights-reserved"]);
	});
});

describe("readSubmittedLicenses", () => {
	it("reads every registered License from one repeated field", () => {
		const form = new FormData();
		form.append("licenses", "all-rights-reserved");
		form.append("licenses", "cc-by-4.0");
		form.append("licenses", "rezics-unit-content-license-v1-1");

		expect(readSubmittedLicenses(form)).toEqual([
			"all-rights-reserved",
			"cc-by-4.0",
			"rezics-unit-content-license-v1-1",
		]);
	});

	it("drops unknown values and duplicate submissions at the API boundary", () => {
		const form = new FormData();
		form.append("licenses", "cc0-1.0");
		form.append("licenses", "unknown");
		form.append("licenses", "cc0-1.0");

		expect(readSubmittedLicenses(form)).toEqual(["cc0-1.0"]);
	});

	it("supports the same License model for preference fields", () => {
		const form = new FormData();
		form.append("defaultLicenses", "rezics-unit-content-license-v1-1");
		expect(readSubmittedLicenses(form, "defaultLicenses")).toEqual([
			"rezics-unit-content-license-v1-1",
		]);
	});
});
