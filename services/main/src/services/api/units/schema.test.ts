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
	creditAttributions: [],
	creditAttributionRequestConsent: "direct_only",
	version: { kind: "main" },
	localization,
	details: { type: "book", releaseStatus: "ongoing" },
} as const;
const ownedMainUnit = {
	ownershipMode: "profile_owned",
	creditAttributions: [
		{
			entityId: "019b0000-0000-7000-8000-000000000001",
			role: "author",
		},
	],
	creditAttributionRequestConsent: "direct_only",
	version: { kind: "main" },
	localization,
	details: { type: "book", releaseStatus: "ongoing" },
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
	it("accepts a creation grant only for a Profile-owned work", () => {
		const contentLicense = {
			referenceLicenseSlug: "rezics-unit-content-license-v1",
		} as const;
		expect(Check(CreateUnitBody, { ...ownedMainUnit, contentLicense })).toBe(true);
		expect(Check(CreateUnitBody, { ...publicMainUnit, contentLicense })).toBe(false);
	});

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
	it("accepts at most 32 distinct initial Tag IDs", () => {
		const tagId = "019b0000-0000-7000-8000-000000000099";
		expect(Check(CreateUnitBody, { ...publicMainUnit, initialTagIds: [tagId] })).toBe(true);
		expect(Check(CreateUnitBody, { ...publicMainUnit, initialTagIds: [tagId, tagId] })).toBe(false);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				initialTagIds: Array.from(
					{ length: 33 },
					(_, index) => `019b0000-0000-7000-8000-${String(index).padStart(12, "0")}`,
				),
			}),
		).toBe(false);
	});

	it("keeps ownership independent from public credit roles", () => {
		expect(
			Check(CreateUnitBody, {
				...ownedMainUnit,
				creditAttributions: [],
			}),
		).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...ownedMainUnit,
				creditAttributions: [
					{
						entityId: "019b0000-0000-7000-8000-000000000001",
						role: "author",
					},
				],
			}),
		).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...ownedMainUnit,
				creditAttributions: [
					{
						entityId: "019b0000-0000-7000-8000-000000000001",
						role: "publisher",
					},
					{
						entityId: "019b0000-0000-7000-8000-000000000002",
						role: "author",
					},
				],
			}),
		).toBe(true);
	});

	it("requires an explicit credit-request consent mode", () => {
		const { creditAttributionRequestConsent: _consent, ...withoutConsent } = publicMainUnit;
		expect(Check(CreateUnitBody, withoutConsent)).toBe(false);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				creditAttributionRequestConsent: "allow_requests",
			}),
		).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				creditAttributionRequestConsent: "always_allow",
			}),
		).toBe(false);
	});

	it("accepts distinct Entity-role pairs and rejects exact duplicates", () => {
		const credit = {
			entityId: "019b0000-0000-7000-8000-000000000001",
			role: "publisher",
		} as const;
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				creditAttributions: [credit, { ...credit, role: "author" }],
			}),
		).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				creditAttributions: [credit, credit],
			}),
		).toBe(false);
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

describe("Book and Media release status inputs", () => {
	it("requires one closed release status when creating a Book or Media Unit", () => {
		for (const releaseStatus of ["ongoing", "hiatus", "completed", "cancelled"])
			expect(
				Check(CreateUnitBody, {
					...publicMainUnit,
					details: { type: "media", releaseStatus },
				}),
			).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				details: { type: "book" },
			}),
		).toBe(false);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				details: { type: "media", releaseStatus: "releasing" },
			}),
		).toBe(false);
	});

	it("does not attach a release status to Software creation details", () => {
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				details: { type: "software" },
			}),
		).toBe(true);
		expect(
			Check(CreateUnitBody, {
				...publicMainUnit,
				details: { type: "software", releaseStatus: "ongoing" },
			}),
		).toBe(false);
	});

	it("accepts only the closed release status set for metadata updates", () => {
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-08-01T00:00:00.000Z",
				details: { releaseStatus: "cancelled" },
			}),
		).toBe(true);
		expect(
			Check(UpdateUnitBody, {
				updatedAt: "2026-08-01T00:00:00.000Z",
				details: { releaseStatus: "unknown" },
			}),
		).toBe(false);
	});
});

describe("Unit partial update shapes", () => {
	const updatedAt = "2026-08-03T00:00:00.000Z";

	it.each([
		["status-only", { updatedAt, status: "published" }],
		["visibility-only", { updatedAt, visibility: "unlisted" }],
		["details-only", { updatedAt, details: { releaseStatus: "ongoing" } }],
	] as const)("accepts a %s patch", (_name, body) => {
		expect(Check(UpdateUnitBody, body)).toBe(true);
	});

	it("rejects an invalid optimistic-concurrency timestamp", () => {
		expect(Check(UpdateUnitBody, { updatedAt: "not-a-date", status: "published" })).toBe(false);
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
