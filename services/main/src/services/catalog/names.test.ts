import { describe, expect, it } from "vitest";
import {
	CatalogNameValuesSchema,
	CatalogNameAuthorityValuesSchema,
	normalizeCatalogIdentifier,
} from "@rezics/schema/contracts/native/names";
import { catalogNameAuthorityApplicability } from "./authority";

const nameId = "00000000-0000-4000-8000-000000000001";
const evidence = { sourceRecordId: nameId, snapshotId: nameId, sourcePath: "/titles/0/official" };
const authority = {
	nameId,
	nameRevision: 1,
	claim: "official" as const,
	reviewState: "source_claim" as const,
	authorizerEntityId: null,
	role: "publisher",
	territory: null,
	channel: null,
	context: null,
	validFrom: null,
	validUntil: null,
	evidence,
	reviewEvidence: null,
	state: "active" as const,
};
const target = {
	nameId,
	revision: 1,
	territory: null,
	channel: null,
	context: null,
	at: new Date("2026-09-07T00:00:00Z"),
};

describe("identified name and authority contracts", () => {
	it("preserves same-language aliases, script precision and unknown language", () => {
		const first = CatalogNameValuesSchema.parse({
			value: "你好",
			kind: "title",
			languageTag: "zh",
		});
		const second = CatalogNameValuesSchema.parse({
			value: "您好",
			kind: "alias",
			languageTag: "ZH-hant-TW",
		});
		expect(first.languageTag).toBe("zh");
		expect(second.languageTag).toBe("zh-Hant-TW");
		expect(
			CatalogNameValuesSchema.parse({ value: "東方", kind: "alias", languageTag: null })
				.languageTag,
		).toBeNull();
	});
	it("retains private-use namespace and pinned registry policy", () => {
		const value = CatalogNameValuesSchema.parse({
			value: "Name",
			kind: "alias",
			languageTag: "x-custom",
			privateUseNamespace: "https://example.test/languages",
		});
		expect(value.privateUseNamespace).toBe("https://example.test/languages");
		expect(value.languagePolicy).toContain("rezics-content-language.1:");
		expect(() =>
			CatalogNameValuesSchema.parse({ value: "Name", kind: "alias", languageTag: "x-custom" }),
		).toThrow();
	});
	it("keeps authorization independent from machine translation and locale selection", () => {
		const value = CatalogNameValuesSchema.parse({
			value: "Hello",
			kind: "title",
			languageTag: "en",
			origin: "translation",
			translationMethod: "machine",
			primaryForLanguage: true,
		});
		expect(value.translationMethod).toBe("machine");
		expect(value).not.toHaveProperty("official");
		expect(() => CatalogNameValuesSchema.parse({ ...value, official: true })).toThrow();
	});
	it("validates source-name lifetime and exact derivation references", () => {
		expect(() =>
			CatalogNameValuesSchema.parse({
				value: "Alias",
				kind: "artist",
				languageTag: null,
				begin: { year: 2025, month: 2, day: 29 },
			}),
		).toThrow();
		expect(() =>
			CatalogNameValuesSchema.parse({
				value: "Alias",
				kind: "artist",
				languageTag: null,
				derivationNameId: nameId,
			}),
		).toThrow();
		expect(
			CatalogNameValuesSchema.parse({
				value: "Alias",
				kind: "artist",
				languageTag: null,
				begin: { year: null, month: 2, day: 29 },
				ended: false,
			}).ended,
		).toBe(false);
	});
	it("bounds complete text by bytes", () => {
		expect(() =>
			CatalogNameValuesSchema.parse({
				value: "中".repeat(44000),
				kind: "alias",
				languageTag: "zh",
			}),
		).toThrow();
	});
	it("does not upgrade a source officialness claim to verified authorization", () => {
		expect(catalogNameAuthorityApplicability(authority, target)).toBe("source_claim");
		expect(() =>
			CatalogNameAuthorityValuesSchema.parse({ ...authority, reviewState: "verified" }),
		).toThrow();
		expect(
			catalogNameAuthorityApplicability(
				{
					...authority,
					reviewState: "verified",
					authorizerEntityId: nameId,
					reviewEvidence: evidence,
				},
				target,
			),
		).toBe("verified_official");
	});
	it("invalidates applicability after text revision, revocation, scope or expiry", () => {
		expect(catalogNameAuthorityApplicability(authority, { ...target, revision: 2 })).toBe(
			"not_applicable",
		);
		expect(catalogNameAuthorityApplicability({ ...authority, state: "withdrawn" }, target)).toBe(
			"not_applicable",
		);
		expect(catalogNameAuthorityApplicability({ ...authority, territory: "JP" }, target)).toBe(
			"not_applicable",
		);
		expect(
			catalogNameAuthorityApplicability(
				{ ...authority, validUntil: "2026-09-07T00:00:00Z" },
				target,
			),
		).toBe("not_applicable");
	});
	it("retains unknown officialness and rejects empty validity intervals", () => {
		expect(
			catalogNameAuthorityApplicability({ ...authority, reviewState: "pending" }, target),
		).toBe("unknown");
		expect(() =>
			CatalogNameAuthorityValuesSchema.parse({
				...authority,
				validFrom: "2026-01-01T00:00:00Z",
				validUntil: "2026-01-01T00:00:00Z",
			}),
		).toThrow();
	});
});

describe("plural identifier claims", () => {
	it("normalizes reviewed namespaces without merging claims", () => {
		expect(
			normalizeCatalogIdentifier({ namespace: "isrc", value: "GB-AHT-16-00302" }),
		).toMatchObject({
			normalizedValue: "GBAHT1600302",
			normalizationPolicy: "isrc.1",
			validationStatus: "valid",
		});
		expect(
			normalizeCatalogIdentifier({ namespace: "label.catalog_number", value: "Ab-001" }),
		).toMatchObject({
			normalizedValue: "Ab-001",
			normalizationPolicy: "exact.1",
			validationStatus: "unvalidated",
		});
		expect(
			normalizeCatalogIdentifier({ namespace: "musicbrainz:artist", value: nameId }),
		).toMatchObject({ normalizedValue: nameId });
	});
	it("checks ISBN and GTIN digits while preserving the submitted representation", () => {
		expect(
			normalizeCatalogIdentifier({ namespace: "isbn", value: "978-0-306-40615-7" }),
		).toMatchObject({ value: "978-0-306-40615-7", normalizedValue: "9780306406157" });
		expect(
			normalizeCatalogIdentifier({ namespace: "isbn", value: "0-8044-2957-X" }).normalizedValue,
		).toBe("080442957X");
		expect(
			normalizeCatalogIdentifier({ namespace: "barcode", value: "4006381333931" }).normalizedValue,
		).toBe("4006381333931");
		expect(() =>
			normalizeCatalogIdentifier({ namespace: "barcode", value: "4006381333932" }),
		).toThrow();
		expect(() =>
			normalizeCatalogIdentifier({ namespace: "isbn", value: "9780306406158" }),
		).toThrow();
	});
});
