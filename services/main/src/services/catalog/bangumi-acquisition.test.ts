import { describe, expect, it } from "vitest";
import { bangumiAcquisitionDescriptor } from "./bangumi-acquisition";

describe("Bangumi acquisition scopes", () => {
	it("uses exact primary and contextual routes without confusing array members with parent IDs", () => {
		expect(bangumiAcquisitionDescriptor("person", "3914").url).toBe(
			"https://api.bgm.tv/v0/persons/3914",
		);
		const related = bangumiAcquisitionDescriptor("character_persons", "77");
		expect(related.url).toBe("https://api.bgm.tv/v0/characters/77/persons");
		expect(related.parse([])).toEqual([]);
		expect(related.authoritativeGone).toBe(false);
	});
	it("pins page offsets and revision identities and rejects URL injection", () => {
		expect(bangumiAcquisitionDescriptor("index_subjects", "1:100").url).toContain(
			"limit=50&offset=100",
		);
		expect(bangumiAcquisitionDescriptor("character_revision", "679589").url).toBe(
			"https://api.bgm.tv/v0/revisions/characters/679589",
		);
		expect(bangumiAcquisitionDescriptor("character_revisions", "77:0").url).toBe(
			"https://api.bgm.tv/v0/revisions/characters?character_id=77&limit=50&offset=0",
		);
		expect(() => bangumiAcquisitionDescriptor("subject", "1/../persons")).toThrow();
		expect(bangumiAcquisitionDescriptor("index_subjects", "1:1000000").url).toContain(
			"offset=1000000",
		);
		expect(() => bangumiAcquisitionDescriptor("index_subjects", "1:9007199254740992")).toThrow();
		expect(() => bangumiAcquisitionDescriptor("character_revision", "77:679589")).toThrow();
	});
});
