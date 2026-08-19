import { describe, expect, it } from "vitest";

import {
	nextUnitUpdatedAt,
	toBookUpdateValues,
	toMediaUpdateValues,
	toSeriesUpdateValues,
	toSoftwareUpdateValues,
	toTimedMediaUpdateValues,
	type UpdateUnitInput,
} from "./update-values";

const ExpectedUpdatedAt = new Date("2026-08-03T10:00:00.123Z");

function update(input: Omit<UpdateUnitInput, "expectedUpdatedAt"> = {}): UpdateUnitInput {
	return { expectedUpdatedAt: ExpectedUpdatedAt, ...input };
}

describe("Unit update values", () => {
	it("advances the aggregate optimistic-concurrency token within the same millisecond", () => {
		expect(nextUnitUpdatedAt(ExpectedUpdatedAt, ExpectedUpdatedAt.getTime()).toISOString()).toBe(
			"2026-08-03T10:00:00.124Z",
		);
		expect(
			nextUnitUpdatedAt(ExpectedUpdatedAt, ExpectedUpdatedAt.getTime() + 10).toISOString(),
		).toBe("2026-08-03T10:00:00.133Z");
	});

	it.each([
		["status-only", update({ status: "published" })],
		["visibility-only", update({ visibility: "unlisted" })],
	] as const)("does not manufacture subtype SQL values for a %s patch", (_name, input) => {
		expect(toBookUpdateValues(input)).toBeUndefined();
		expect(toSoftwareUpdateValues(input)).toBeUndefined();
		expect(toMediaUpdateValues(input)).toBeUndefined();
		expect(toTimedMediaUpdateValues(input)).toBeUndefined();
		expect(toSeriesUpdateValues(input)).toBeUndefined();
	});

	it("maps only supplied Book details and preserves explicit null", () => {
		expect(
			toBookUpdateValues(
				update({
					details: { releaseStatus: "ongoing", isbn13: null, wordCount: 120_000 },
				}),
			),
		).toEqual({
			releaseStatus: "ongoing",
			metadataOnly: undefined,
			isbn13: null,
			publicationDate: undefined,
			pageCount: undefined,
			wordCount: 120_000,
		});
	});

	it("maps the Book metadata-only presentation policy independently", () => {
		expect(toBookUpdateValues(update({ details: { metadataOnly: true } }))).toEqual({
			releaseStatus: undefined,
			metadataOnly: true,
			isbn13: undefined,
			publicationDate: undefined,
			pageCount: undefined,
			wordCount: undefined,
		});
	});

	it("uses releasedOn as the Book publication date only when publicationDate is omitted", () => {
		expect(
			toBookUpdateValues(update({ unit: { releasedOn: "2026-08-03" }, details: {} })),
		).toMatchObject({ publicationDate: "2026-08-03" });
		expect(
			toBookUpdateValues(
				update({
					unit: { releasedOn: "2026-08-03" },
					details: { publicationDate: null },
				}),
			),
		).toMatchObject({ publicationDate: null });
	});

	it("maps Software, Media, timed-media, and Series details independently", () => {
		expect(
			toSoftwareUpdateValues(
				update({ unit: { releasedOn: null }, details: { versionLabel: "1.0.0" } }),
			),
		).toEqual({ metadataOnly: undefined, releaseDate: null, versionLabel: "1.0.0" });
		expect(
			toMediaUpdateValues(
				update({
					details: { kind: "animation", episodeCount: 12, releaseStatus: "completed" },
				}),
			),
		).toEqual({
			releaseStatus: "completed",
			metadataOnly: undefined,
			releaseDate: undefined,
			kind: "animation",
			runtimeMinutes: undefined,
			episodeCount: 12,
			seasonCount: undefined,
		});
		expect(toTimedMediaUpdateValues(update({ details: { durationSeconds: 300 } }))).toEqual({
			durationSeconds: 300,
		});
		expect(toSeriesUpdateValues(update({ details: { kind: "franchise" } }))).toEqual({
			kind: "franchise",
		});
	});
});
