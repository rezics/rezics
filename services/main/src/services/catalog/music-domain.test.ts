import { describe, expect, it } from "vitest";
import { MusicDiscTocInputSchema, MusicReleaseMetadataSchema } from "./music-domain";

describe("native physical music contracts", () => {
	it("preserves ordered physical offsets and optional source-independent identifiers", () => {
		const value = { offsets: [150, 15000, 32000], leadoutOffset: 50000 };
		expect(MusicDiscTocInputSchema.parse(value)).toEqual(value);
		expect(
			MusicDiscTocInputSchema.parse({
				offsets: Array.from({ length: 99 }, (_, i) => i * 1000),
				leadoutOffset: 100000,
			}).offsets,
		).toHaveLength(99);
	});
	it.each([
		{ offsets: [], leadoutOffset: 100 },
		{ offsets: Array.from({ length: 100 }, (_, i) => i), leadoutOffset: 100 },
		{ offsets: [150, 150], leadoutOffset: 1000 },
		{ offsets: [200, 150], leadoutOffset: 1000 },
		{ offsets: [150, 1000], leadoutOffset: 1000 },
		{ offsets: [150], leadoutOffset: 100 },
		{ offsets: [0.5], leadoutOffset: 100 },
		{ offsets: [-1], leadoutOffset: 100 },
		{ offsets: [150], leadoutOffset: Number.MAX_SAFE_INTEGER + 1 },
	])("rejects physically inconsistent or unsafe TOCs: %j", (input) => {
		expect(MusicDiscTocInputSchema.safeParse(input).success).toBe(false);
	});
	it("keeps cleared release values distinct from omitted changes", () => {
		expect(MusicReleaseMetadataSchema.parse({ barcode: null })).toEqual({ barcode: null });
		expect(MusicReleaseMetadataSchema.parse({ barcode: "" })).toEqual({ barcode: "" });
		expect(MusicReleaseMetadataSchema.parse({ languageTag: "EN-us", scriptCode: "Latn" })).toEqual({
			languageTag: "en-US",
			scriptCode: "Latn",
		});
	});
	it.each([
		{},
		{ barcode: undefined },
		{ languageTag: "" },
		{ scriptCode: "LATN" },
		{ source: "musicbrainz" },
		{ statusRevisionId: "official" },
	])("rejects an invalid native metadata command: %j", (input) => {
		expect(MusicReleaseMetadataSchema.safeParse(input).success).toBe(false);
	});
});
