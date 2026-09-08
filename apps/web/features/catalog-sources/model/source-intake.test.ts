import { describe, expect, it } from "vitest";
import { sourceIntakeBody } from "./source-intake";
describe("source intake boundary", () => {
	it("does not cross provider object families", () => {
		expect(sourceIntakeBody("openlibrary", "recording", "OL1W")).toBeNull();
		expect(sourceIntakeBody("bangumi", "author", "1")).toBeNull();
	});
	it("validates provider identifiers without inventing native identities", () => {
		expect(sourceIntakeBody("musicbrainz", "release", "1")).toBeNull();
		expect(sourceIntakeBody("bangumi", "subject", "0")).toBeNull();
		expect(sourceIntakeBody("bangumi", "subject", " 123 ")).toEqual({
			source: "bangumi",
			objectType: "subject",
			externalId: "123",
		});
	});
	it("preserves provider keys and bounds input", () => {
		expect(sourceIntakeBody("openlibrary", "work", " /works/OL1W ")?.externalId).toBe(
			"/works/OL1W",
		);
		expect(sourceIntakeBody("vndb", "vn", "x".repeat(513))).toBeNull();
	});
});
