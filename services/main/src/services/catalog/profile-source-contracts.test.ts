import { describe, expect, it } from "vitest";
import { parseCatalogSourceProfile } from "./profile-source-contracts";
import { musicBrainzSupportingObservedProfileFields } from "./musicbrainz-supporting-profile";
import { parseMusicBrainzSupportingEndpoint } from "./musicbrainz-entities";

describe("pure source profile field scope", () => {
	it("keeps defaulted native fields outside a partial observation's authority", () => {
		const parsed = parseCatalogSourceProfile("entity", { genderRevisionId: null }, [
			"genderRevisionId",
		]);
		expect(parsed.observedFields).toEqual(["genderRevisionId"]);
		expect(parsed.sourceProfile).toMatchObject({ genderRevisionId: null, areaId: null });
		expect(
			parseCatalogSourceProfile("entity", { genderRevisionId: null, areaId: crypto.randomUUID() }, [
				"genderRevisionId",
			]).sourceProfile,
		).toMatchObject({ areaId: null });
		expect(() =>
			parseCatalogSourceProfile("entity", { genderRevisionId: null }, ["areaId"]),
		).toThrow("absent");
	});
	it("rejects invented fields, duplicate scopes and invalid native values", () => {
		expect(() => parseCatalogSourceProfile("entity", { invented: null }, ["invented"])).toThrow();
		expect(() => parseCatalogSourceProfile("entity", { ended: false }, ["ended", "ended"])).toThrow(
			"duplicate",
		);
		expect(() =>
			parseCatalogSourceProfile("reference", { shape: "place", latitude: 92, longitude: 0 }, [
				"latitude",
				"longitude",
			]),
		).toThrow();
	});
	it("retains independently unknown date precision", () => {
		expect(
			parseCatalogSourceProfile("entity", { begin: { year: null, month: 2, day: 29 } }, ["begin"])
				.observedFields,
		).toEqual(["begin"]);
		expect(() =>
			parseCatalogSourceProfile("entity", { begin: { year: 2023, month: 2, day: 29 } }, ["begin"]),
		).toThrow();
	});
	it("derives source scope from observed endpoint fields before native defaults", () => {
		const minimal = parseMusicBrainzSupportingEndpoint("artist", {
			id: crypto.randomUUID(),
			name: "Artist",
		});
		expect(musicBrainzSupportingObservedProfileFields(minimal)).toEqual([]);
		const partial = parseMusicBrainzSupportingEndpoint("artist", {
			id: crypto.randomUUID(),
			name: "Artist",
			gender: null,
			"life-span": { begin: "1980" },
		});
		expect(musicBrainzSupportingObservedProfileFields(partial)).toEqual([
			"begin",
			"genderRevisionId",
		]);
	});
});
