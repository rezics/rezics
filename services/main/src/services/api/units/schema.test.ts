import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateUnitBody, UpdateUnitBody } from "./schema";

const localization = { language: "en", title: "Example" };

describe("Unit publication License inputs", () => {
	it("accepts registered License IDs and null", () => {
		expect(Check(CreateUnitBody, { localization, license: "cc-by-4.0" })).toBe(true);
		expect(Check(CreateUnitBody, { localization, license: null })).toBe(true);
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-21T00:00:00.000Z",
				license: "all-rights-reserved",
			}),
		).toBe(true);
	});

	it("rejects arbitrary text and external identifier casing", () => {
		expect(Check(CreateUnitBody, { localization, license: "custom terms" })).toBe(false);
		expect(Check(CreateUnitBody, { localization, license: "CC-BY-4.0" })).toBe(false);
	});
});
