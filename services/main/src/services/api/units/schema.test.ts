import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CatalogUnitTypeParams,
	CreateUnitBody,
	UpdateUnitBody,
	UnitLocalizationDeleteBody,
	UnitLocalizationOrderBody,
	VariantUnitTypeParams,
} from "./schema";

const localization = { language: "en", title: "Example" };
const publicMainUnit = {
	catalogMode: "public_entry",
	version: { kind: "main" },
	localization,
} as const;

describe("Unit publication License inputs", () => {
	it("accepts registered License IDs and null", () => {
		expect(Check(CreateUnitBody, { ...publicMainUnit, license: "cc-by-4.0" })).toBe(true);
		expect(Check(CreateUnitBody, { ...publicMainUnit, license: null })).toBe(true);
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-21T00:00:00.000Z",
				license: "all-rights-reserved",
			}),
		).toBe(true);
	});

	it("rejects arbitrary text and external identifier casing", () => {
		expect(Check(CreateUnitBody, { ...publicMainUnit, license: "custom terms" })).toBe(false);
		expect(Check(CreateUnitBody, { ...publicMainUnit, license: "CC-BY-4.0" })).toBe(false);
	});
});

describe("Catalog creation semantics", () => {
	it("requires a publisher Entity for owned works", () => {
		expect(
			Check(CreateUnitBody, {
				catalogMode: "owned_work",
				version: { kind: "main" },
				localization,
			}),
		).toBe(false);
		expect(
			Check(CreateUnitBody, {
				catalogMode: "owned_work",
				publisher: { entityId: "019b0000-0000-7000-8000-000000000001" },
				version: { kind: "main" },
				localization,
			}),
		).toBe(true);
	});

	it("requires a Main Unit only for Variants", () => {
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				version: { kind: "variant" },
			}),
		).toBe(false);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				version: {
					kind: "variant",
					mainUnitId: "019b0000-0000-7000-8000-000000000002",
				},
			}),
		).toBe(true);
	});
});

describe("Catalog Unit route types", () => {
	it("accepts Series on generic read and update routes", () => {
		expect(Check(CatalogUnitTypeParams, { type: "series" })).toBe(true);
	});

	it("keeps Series out of variant-only creation routes", () => {
		expect(Check(VariantUnitTypeParams, { type: "series" })).toBe(false);
		expect(Check(VariantUnitTypeParams, { type: "book" })).toBe(true);
	});
});

describe("Unit content language order inputs", () => {
	it("accepts a complete non-empty unique language sequence", () => {
		expect(
			Check(UnitLocalizationOrderBody, {
				expectedLanguages: ["zh", "en"],
				languages: ["en", "zh"],
			}),
		).toBe(true);
		expect(Check(UnitLocalizationDeleteBody, { expectedLanguages: ["zh"] })).toBe(true);
	});

	it("rejects empty, duplicate, and unsupported language sequences", () => {
		expect(
			Check(UnitLocalizationOrderBody, {
				expectedLanguages: [],
				languages: ["en"],
			}),
		).toBe(false);
		expect(
			Check(UnitLocalizationOrderBody, {
				expectedLanguages: ["zh", "en"],
				languages: ["zh", "zh"],
			}),
		).toBe(false);
		expect(Check(UnitLocalizationDeleteBody, { expectedLanguages: ["ja"] })).toBe(true);
		expect(Check(UnitLocalizationDeleteBody, { expectedLanguages: ["zh-Hans"] })).toBe(false);
	});
});
