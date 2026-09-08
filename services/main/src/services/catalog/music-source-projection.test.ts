import { describe, expect, it } from "vitest";
import { mergeMusicSourceValue } from "./music-source-projection";

const before = {
	id: "11111111-1111-4111-8111-111111111111",
	identity_shape: "release",
	release_group_id: null,
	artist_credit_id: null,
	status_revision_id: null,
	packaging_revision_id: null,
	language_tag: null,
	script_code: null,
	barcode: "source-before",
};
describe("music pure source/native row merge", () => {
	it("applies changed source fields while retaining unrelated native corrections", () => {
		expect(
			mergeMusicSourceValue(
				"music_release",
				before,
				{ ...before, barcode: "source-after" },
				{ ...before, script_code: "Latn" },
			),
		).toMatchObject({ barcode: "source-after", script_code: "Latn" });
	});
	it("unchanged source values preserve a corrected native field", () => {
		expect(
			mergeMusicSourceValue("music_release", before, before, { ...before, barcode: "human" }),
		).toMatchObject({ barcode: "human" });
	});
	it("rejects conflicting edits and unvalidated native shapes", () => {
		expect(() =>
			mergeMusicSourceValue(
				"music_release",
				before,
				{ ...before, barcode: "source-after" },
				{ ...before, barcode: "human" },
			),
		).toThrow("independent native edit");
		expect(() =>
			mergeMusicSourceValue("music_release", before, { ...before, invented: "field" }, before),
		).toThrow();
	});
});
