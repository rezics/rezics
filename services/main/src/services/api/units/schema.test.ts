import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import { MaximumAudioTracksPerVideo } from "../../database/schema/contract-values";
import {
	CreateTimedMediaBody,
	ContentLanguageEvidenceUnitParams,
	TimedMediaUnitTypeParams,
	ResolveUnitPresentationsBody,
	UpdateUnitBody,
	UnitLocalizationDeleteBody,
	UnitLocalizationOrderBody,
} from "./schema";

describe("Unit presentation localization", () => {
	it("accepts omitted or empty localization hints", () => {
		const id = "019b0000-0000-7000-8000-000000000001";
		expect(
			Check(ResolveUnitPresentationsBody, {
				ids: [id],
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
		expect(Check(ResolveUnitPresentationsBody, { ids: [id] })).toBe(true);
		expect(
			Check(ResolveUnitPresentationsBody, {
				ids: [id],
				localizationLanguages: [],
			}),
		).toBe(true);
		expect(
			Check(ResolveUnitPresentationsBody, {
				ids: [id],
				localizationLanguages: ["en", "en"],
			}),
		).toBe(false);
	});
});

describe("native timed-media creation", () => {
	const localization = { language: "en", title: "Example" };
	it("requires a concrete owner and rejects retired authoring fields", () => {
		for (const owner of ["audio", "video"])
			expect(Check(CreateTimedMediaBody, { owner, localization })).toBe(true);
		for (const owner of ["book", "media", "software", "release", "series"])
			expect(Check(CreateTimedMediaBody, { owner, localization })).toBe(false);
		expect(
			Check(CreateTimedMediaBody, { owner: "audio", localization, version: { kind: "main" } }),
		).toBe(false);
		expect(
			Check(CreateTimedMediaBody, { owner: "audio", localization, adaptedAudioUnitIds: [] }),
		).toBe(false);
	});
	it("bounds duration to the persisted positive integer range", () => {
		for (const durationSeconds of [1, 2147483647, null])
			expect(Check(CreateTimedMediaBody, { owner: "audio", localization, durationSeconds })).toBe(
				true,
			);
		for (const durationSeconds of [0, -1, 0.5, 2147483648])
			expect(Check(CreateTimedMediaBody, { owner: "audio", localization, durationSeconds })).toBe(
				false,
			);
	});
	it("limits shared timed-media routes to actual audio/video owners", () => {
		for (const type of ["audio", "video"]) {
			expect(Check(TimedMediaUnitTypeParams, { type })).toBe(true);
			expect(
				Check(ContentLanguageEvidenceUnitParams, {
					type,
					unitId: "019b0000-0000-7000-8000-000000000001",
				}),
			).toBe(true);
		}
		for (const type of ["book", "release", "series", "media", "software"])
			expect(Check(TimedMediaUnitTypeParams, { type })).toBe(false);
	});
});

describe("timed-media license updates", () => {
	const updatedAt = "2026-07-31T00:00:00.000Z";
	it("validates registered offerings independently", () => {
		expect(
			Check(UpdateUnitBody, {
				updatedAt,
				licenses: ["all-rights-reserved", "cc-by-4.0", "rezics-unit-content-license-v1-1"],
			}),
		).toBe(true);
		for (const license of ["custom terms", "CC-BY-4.0", "rezics-unit-content-license-v2"])
			expect(Check(UpdateUnitBody, { updatedAt, licenses: [license] })).toBe(false);
	});
});

describe("Unit partial update shapes", () => {
	const updatedAt = "2026-08-03T00:00:00.000Z";

	it.each([
		["status-only", { updatedAt, status: "published" }],
		["visibility-only", { updatedAt, visibility: "unlisted" }],
		["details-only", { updatedAt, details: { durationSeconds: 120 } }],
	] as const)("accepts a %s patch", (_name, body) => {
		expect(Check(UpdateUnitBody, body)).toBe(true);
	});

	it("rejects an invalid optimistic-concurrency timestamp", () => {
		expect(Check(UpdateUnitBody, { updatedAt: "not-a-date", status: "published" })).toBe(false);
	});

	it("rejects an open-ended Book draft scope", () => {
		expect(Check(UpdateUnitBody, { updatedAt, bookChapterDraftScope: "all_chapters" })).toBe(false);
	});

	it("rejects details.format", () => {
		expect(Check(UpdateUnitBody, { updatedAt, details: { format: "paperback" } })).toBe(false);
		expect(
			Check(UpdateUnitBody, {
				updatedAt,
				details: { releaseStatus: "ongoing", format: "paperback" },
			}),
		).toBe(false);
	});

	it("accepts bounded adapted Audio replacement and clear operations", () => {
		const audioIds = Array.from(
			{ length: MaximumAudioTracksPerVideo },
			(_, index) => `019b0000-0000-7000-8000-${String(index).padStart(12, "0")}`,
		);
		expect(Check(UpdateUnitBody, { updatedAt, details: { adaptedAudioUnitIds: null } })).toBe(true);
		expect(Check(UpdateUnitBody, { updatedAt, details: { adaptedAudioUnitIds: [] } })).toBe(true);
		expect(Check(UpdateUnitBody, { updatedAt, details: { adaptedAudioUnitIds: audioIds } })).toBe(
			true,
		);
		expect(
			Check(UpdateUnitBody, {
				updatedAt,
				details: {
					adaptedAudioUnitIds: [...audioIds, "019b0000-0000-7000-8000-000000000064"],
				},
			}),
		).toBe(false);
		expect(
			Check(UpdateUnitBody, {
				updatedAt,
				details: { adaptedAudioUnitIds: [audioIds[0], audioIds[0]] },
			}),
		).toBe(false);
		expect(
			Check(UpdateUnitBody, {
				updatedAt,
				details: { adaptedAudioUnitIds: ["not-an-audio-unit"] },
			}),
		).toBe(false);
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
