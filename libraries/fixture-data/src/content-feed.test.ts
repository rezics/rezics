import { describe, expect, it } from "vitest";

import { FixtureContentLanguages, getFeedFixtureData } from "./content-feed";

describe("content feed fixture data", () => {
	it("provides complete localized fixtures for every supported content language", () => {
		const fixtures = FixtureContentLanguages.map(getFeedFixtureData);

		expect(fixtures).toHaveLength(FixtureContentLanguages.length);
		expect(fixtures.every((fixture) => fixture.post.title.length > 0)).toBe(true);
		expect(new Set(fixtures.map((fixture) => fixture.post.title)).size).toBe(
			FixtureContentLanguages.length,
		);
	});

	it("keeps identity, timing, assets, and metrics stable across localizations", () => {
		const traditionalChinese = getFeedFixtureData("zh");
		const english = getFeedFixtureData("en");

		expect(english).toMatchObject({
			referenceTime: traditionalChinese.referenceTime,
			createdAt: traditionalChinese.createdAt,
			recommendationReason: traditionalChinese.recommendationReason,
			metrics: traditionalChinese.metrics,
		});
		expect(english.attributions.map(({ id, href }) => ({ id, href }))).toEqual(
			traditionalChinese.attributions.map(({ id, href }) => ({ id, href })),
		);
		expect(english.realms.map(({ id, href }) => ({ id, href }))).toEqual(
			traditionalChinese.realms.map(({ id, href }) => ({ id, href })),
		);
		expect(english.post.mediaAsset).toBe(traditionalChinese.post.mediaAsset);
		expect(english.collection.coverAsset).toBe(traditionalChinese.collection.coverAsset);
	});

	it("always exercises mixed ordered attributions and multiple Realm contexts", () => {
		for (const language of FixtureContentLanguages) {
			const fixture = getFeedFixtureData(language);

			expect(fixture.attributions.length).toBeGreaterThan(1);
			expect(fixture.realms.length).toBeGreaterThan(1);
			expect(new Set(fixture.attributions.map((attribution) => attribution.id)).size).toBe(
				fixture.attributions.length,
			);
			expect(new Set(fixture.attributions.map(({ kind }) => kind))).toEqual(
				new Set(["profile", "entity"]),
			);
			expect(new Set(fixture.realms.map((realm) => realm.id)).size).toBe(fixture.realms.length);
		}
	});

	it("uses a reference time after the fixture content creation time", () => {
		const fixture = getFeedFixtureData("en");

		expect(new Date(fixture.referenceTime).getTime()).toBeGreaterThan(
			new Date(fixture.createdAt).getTime(),
		);
	});
});
