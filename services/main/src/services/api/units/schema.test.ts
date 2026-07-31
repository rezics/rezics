import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	WorkUnitTypeParams,
	CreateUnitBody,
	ManageableUnitTypeParams,
	ResolveUnitPresentationsBody,
	UpdateUnitBody,
	UnitLocalizationDeleteBody,
	UnitLocalizationOrderBody,
	UnitSeriesMembershipQuery,
	VariantUnitTypeParams,
} from "./schema";

const localization = { language: "en", title: "Example" };
const publicMainUnit = {
	ownershipMode: "community_owned",
	version: { kind: "main" },
	localization,
} as const;

describe("Unit presentation localization", () => {
	it("requires an ordered, non-empty localization priority", () => {
		const id = "019b0000-0000-7000-8000-000000000001";
		expect(
			Check(ResolveUnitPresentationsBody, {
				ids: [id],
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
		expect(Check(ResolveUnitPresentationsBody, { ids: [id] })).toBe(false);
		expect(
			Check(ResolveUnitPresentationsBody, {
				ids: [id],
				localizationLanguages: [],
			}),
		).toBe(false);
	});

	it("requires localization priority for Series membership cards", () => {
		expect(
			Check(UnitSeriesMembershipQuery, {
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
		expect(Check(UnitSeriesMembershipQuery, {})).toBe(false);
	});
});

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

describe("Unit content License inputs", () => {
	it("accepts the registered one-time grant and omission", () => {
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-31T00:00:00.000Z",
				details: {
					contentLicense: {
						referenceLicenseSlug: "rezics-unit-content-license-v1",
					},
				},
			}),
		).toBe(true);
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-31T00:00:00.000Z",
				details: {},
			}),
		).toBe(true);
	});

	it("rejects revocation and unknown License versions", () => {
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-31T00:00:00.000Z",
				details: { contentLicense: null },
			}),
		).toBe(false);
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-07-31T00:00:00.000Z",
				details: {
					contentLicense: {
						referenceLicenseSlug: "rezics-unit-content-license-v2",
					},
				},
			}),
		).toBe(false);
	});
});

describe("Unit creation semantics", () => {
	it("requires a publisher Entity for owned works", () => {
		expect(
			Check(CreateUnitBody, {
				ownershipMode: "profile_owned",
				version: { kind: "main" },
				localization,
			}),
		).toBe(false);
		expect(
			Check(CreateUnitBody, {
				ownershipMode: "profile_owned",
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

describe("Work Unit route types", () => {
	it("accepts Series on generic read and update routes", () => {
		expect(Check(WorkUnitTypeParams, { type: "series" })).toBe(true);
	});

	it("keeps Series out of variant-only creation routes", () => {
		expect(Check(VariantUnitTypeParams, { type: "series" })).toBe(false);
		expect(Check(VariantUnitTypeParams, { type: "book" })).toBe(true);
	});

	it("addresses timed media through manageable routes without adding work creation types", () => {
		expect(Check(ManageableUnitTypeParams, { type: "video" })).toBe(true);
		expect(Check(ManageableUnitTypeParams, { type: "audio" })).toBe(true);
		expect(Check(WorkUnitTypeParams, { type: "video" })).toBe(false);
		expect(Check(WorkUnitTypeParams, { type: "audio" })).toBe(false);
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
