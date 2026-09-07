import { describe, expect, it } from "vitest";
import {
	SoftwareContentDetailsSchema,
	SoftwareReleaseComponentSchema,
	SoftwareReleaseDetailsSchema,
	SoftwareVersionDetailsSchema,
} from "./software";
import { SoftwareAnimationSchema, vndbAnimation } from "./software-animation";
import { planVndbRelease, vndbReleaseDate } from "./vndb-release";
import { vndbMedium, vndbPlatform } from "./vndb-vocabulary";
import { VndbReleaseSchema } from "./vndb";

describe("native software and VNDB distribution", () => {
	it("requires evidence for an independent version and retains language semantics", () => {
		expect(() =>
			SoftwareVersionDetailsSchema.parse({
				kind: "translation",
				languageTag: "zh-CN",
				distinguishingEvidence: "",
			}),
		).toThrow();
		expect(
			SoftwareVersionDetailsSchema.parse({
				kind: "translation",
				languageTag: "zh-hant",
				distinguishingEvidence: "Publisher identifies this as revised Traditional Chinese script",
			}),
		).toMatchObject({ languageTag: "zh-Hant", kind: "translation" });
		expect(() =>
			SoftwareVersionDetailsSchema.parse({
				kind: "edition",
				distinguishingEvidence: "VN staff list number",
			}),
		).toThrow();
	});
	it("keeps unknown and non-standard resolution distinct from actual pixel dimensions", () => {
		expect(
			planVndbRelease({ id: "r1", title: "Release", resolution: "non-standard" }).details
				.resolution,
		).toEqual({ kind: "non_standard" });
		expect(
			planVndbRelease({ id: "r1", title: "Release", resolution: null }).details.resolution,
		).toBeNull();
		expect(
			planVndbRelease({ id: "r1", title: "Release", resolution: [1920, 1080] }).details.resolution,
		).toEqual({ kind: "pixels", width: 1920, height: 1080 });
		expect(() =>
			SoftwareReleaseDetailsSchema.parse({
				resolution: { kind: "pixels", width: 0, height: 1080 },
			}),
		).toThrow();
	});
	it("maps patches, carriers, languages and availability without manufacturing version identities", () => {
		const planned = planVndbRelease({
			id: "r2",
			title: "Patch",
			patch: true,
			official: false,
			freeware: true,
			has_ero: true,
			minage: 18,
			released: "2026-09",
			voiced: 2,
			media: [{ medium: "in", qty: 0 }],
			vns: [{ id: "v17", rtype: "partial" }],
			languages: [{ lang: "ta", main: true, mtl: true, title: null, latin: null }],
		});
		expect(planned.details).toMatchObject({
			isPatch: true,
			minimumAge: 18,
			voicing: "erotic_only",
			date: { year: 2026, month: 9, day: null },
		});
		expect(planned.record.official).toBe(false);
		expect(planned.record.languages?.[0]?.mtl).toBe(true);
		expect(planned.record.vns?.[0]).not.toHaveProperty("versionId");
		expect(vndbPlatform("win")).toBe("windows");
		expect(vndbMedium("in")).toBe("internet_download");
		expect(() => vndbPlatform("new-platform")).toThrow("review");
	});
	it("validates partial dates and preserves TBA", () => {
		expect(vndbReleaseDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29, text: null });
		expect(vndbReleaseDate("TBA")).toEqual({ year: null, month: null, day: null, text: "TBA" });
		expect(vndbReleaseDate(null)).toEqual({ year: null, month: null, day: null, text: null });
		expect(() => vndbReleaseDate("2023-02-29")).toThrow();
		expect(() => vndbReleaseDate("2025-13")).toThrow();
	});
	it("rejects unsafe numeric and byte claims at source/native boundaries", () => {
		expect(() =>
			VndbReleaseSchema.parse({
				id: "r2",
				title: "R",
				media: [{ medium: "dvd", qty: Number.MAX_SAFE_INTEGER + 1 }],
			}),
		).toThrow();
		expect(() =>
			SoftwareContentDetailsSchema.parse({ description: "字".repeat(180000) }),
		).toThrow();
		expect(() =>
			SoftwareReleaseComponentSchema.parse({ kind: "language", languageTag: "not a language" }),
		).toThrow();
	});
	it("decodes animation contexts without collapsing sentinel values or frequency", () => {
		expect(vndbAnimation("story_sprite", null).state).toBe("unknown");
		expect(vndbAnimation("story_sprite", 0).state).toBe("none");
		expect(vndbAnimation("story_sprite", 1).state).toBe("not_applicable");
		expect(vndbAnimation("story_sprite", 4 + 16 + 256)).toMatchObject({
			state: "animated",
			handDrawn: true,
			threeDimensional: true,
			frequency: "some",
		});
		expect(() => vndbAnimation("cutscene", 4 + 256)).toThrow();
		expect(() => vndbAnimation("story_sprite", 4 + 256 + 512)).toThrow();
		expect(() => vndbAnimation("story_sprite", 2)).toThrow();
		expect(() =>
			SoftwareAnimationSchema.parse({ context: "story_scene", state: "animated" }),
		).toThrow();
	});
});
