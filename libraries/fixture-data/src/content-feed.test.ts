import { describe, expect, it } from "vitest";

import { FixtureContentLanguages, getFeedFixtureData } from "./content-feed";

describe("content feed fixture data", () => {
	it("provides a complete localized catalog for every supported content language", () => {
		const catalogs = FixtureContentLanguages.map(getFeedFixtureData);

		expect(catalogs).toHaveLength(FixtureContentLanguages.length);
		expect(catalogs.every((catalog) => catalog.post.title.length > 0)).toBe(true);
		expect(new Set(catalogs.map((catalog) => catalog.post.title)).size).toBe(
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
		expect(english.publishers.map(({ id, href }) => ({ id, href }))).toEqual(
			traditionalChinese.publishers.map(({ id, href }) => ({ id, href })),
		);
		expect(english.realms.map(({ id, href }) => ({ id, href }))).toEqual(
			traditionalChinese.realms.map(({ id, href }) => ({ id, href })),
		);
		expect(english.post.mediaAsset).toBe(traditionalChinese.post.mediaAsset);
		expect(english.collection.coverAsset).toBe(traditionalChinese.collection.coverAsset);
	});

	it("always exercises multiple ordered publishers and realm contexts", () => {
		for (const language of FixtureContentLanguages) {
			const fixture = getFeedFixtureData(language);

			expect(fixture.publishers.length).toBeGreaterThan(1);
			expect(fixture.realms.length).toBeGreaterThan(1);
			expect(new Set(fixture.publishers.map((publisher) => publisher.id)).size).toBe(
				fixture.publishers.length,
			);
			expect(new Set(fixture.realms.map((realm) => realm.id)).size).toBe(
				fixture.realms.length,
			);
		}
	});

	it("uses a reference time after the fixture content creation time", () => {
		const fixture = getFeedFixtureData("en");

		expect(new Date(fixture.referenceTime).getTime()).toBeGreaterThan(
			new Date(fixture.createdAt).getTime(),
		);
	});
});
