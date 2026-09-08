import { describe, expect, it } from "vitest";
import {
	VndbAnimeSchema,
	VndbAnimeProgramTypes,
	planVndbAnimeIdentifiers,
	planVndbAnimeNames,
	planVndbAnimeSemantics,
} from "./vndb-anime-plans";
import { normalizeVndbVnDump } from "./vndb-vn-dump";
const record = VndbAnimeSchema.parse({
	id: 42,
	ann_id: [1, 2],
	mal_id: [3],
	type: "tv",
	year: 2001,
	title_romaji: "An English Main Title",
	title_kanji: "日本語の題名",
});
describe("observed VNDB AniDB mirror", () => {
	it("maps all public type codes to governed program meanings and keeps observed year precision", () => {
		expect(Object.keys(VndbAnimeProgramTypes)).toEqual([
			"tv",
			"ova",
			"mov",
			"oth",
			"web",
			"spe",
			"mv",
		]);
		expect(planVndbAnimeSemantics(record).facts[0]).toMatchObject({
			key: "program-start-year",
			value: 2001,
			path: "/year",
		});
		expect(planVndbAnimeSemantics({ ...record, year: null }).facts[0]?.value).toBeNull();
	});
	it("does not invent a transliteration relation for AniDB's language-unspecified main title", () => {
		const names = planVndbAnimeNames(record);
		expect(names[0]?.fields).toMatchObject({
			value: "An English Main Title",
			languageTag: null,
			origin: "unknown",
		});
		expect(names[1]?.fields).toMatchObject({ value: "日本語の題名", languageTag: "ja" });
		expect(names.every((name) => name.derivationKey === undefined)).toBe(true);
		expect(planVndbAnimeNames({ ...record, title_romaji: null, title_kanji: null })).toEqual([]);
	});
	it("retains each AniDB/ANN/MAL claim with an exact mirror-column pointer", () => {
		expect(planVndbAnimeIdentifiers(record)).toEqual([
			{ namespace: "anidb.anime", value: "42", path: "/id" },
			{ namespace: "animenewsnetwork.anime", value: "1", path: "/ann_id/0" },
			{ namespace: "animenewsnetwork.anime", value: "2", path: "/ann_id/1" },
			{ namespace: "myanimelist.anime", value: "3", path: "/mal_id/0" },
		]);
	});
	it("models VN anime links as related Programs without claiming adaptation direction", () => {
		const plan = normalizeVndbVnDump({
			vn: {
				id: "v1",
				image: null,
				c_image: null,
				olang: "ja",
				c_votecount: 0,
				c_rating: null,
				c_average: null,
				c_length: null,
				c_lengthnum: 0,
				length: 0,
				devstatus: 0,
				alias: "",
				description: "",
			},
			titles: [{ id: "v1", lang: "ja", title: "作品", latin: null, official: true }],
			editions: [],
			staff: [],
			seiyuu: [],
			staff_alias: [],
			relations: [],
			screenshots: [],
			images: [],
			links: [],
			extlinks: [],
			anime: [{ id: "v1", aid: 42 }],
		});
		expect(plan.extraSemantics.relations[0]).toMatchObject({
			key: "related-program",
			participants: [
				{
					role: "program",
					target: {
						owner: "program",
						shape: "program",
						objectType: "anime",
						externalId: "42",
						path: "/anime/0/aid",
					},
				},
			],
		});
	});
});
