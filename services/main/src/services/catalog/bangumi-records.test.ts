import { describe, expect, it } from "vitest";
import {
	BangumiArchiveRelationSchema,
	BangumiCharacterSchema,
	BangumiPersonSchema,
	bangumiRelationKey,
	parseBangumiWiki,
	planBangumiEpisode,
	selectBangumiRevisionWiki,
	BangumiIndexSchema,
} from "./bangumi-records";
import { ProgramStructureSchema } from "./program";

const episode = {
	id: 519,
	subject_id: 253,
	type: 0,
	name: "Episode",
	name_cn: "",
	sort: 1.5,
	ep: 2,
	airdate: "1998-10-23",
	comment: 109,
	duration: "00:24:43",
	desc: "",
	disc: 0,
	duration_seconds: 1483,
};
const profile = {
	id: 3914,
	name: "Person",
	type: 1,
	summary: "",
	images: null,
	infobox: [{ key: "blood type", value: "A" }],
	locked: false,
	stat: { comments: 0, collects: 0 },
	blood_type: null,
	birth_year: 1961,
	birth_mon: 6,
	birth_day: 17,
	gender: "male",
};

describe("Bangumi native conformance", () => {
	it("requires explicit selection of historical wiki members and retains unavailable revisions", () => {
		const revision = {
			id: 679589,
			type: 2,
			created_at: "2017-03-10T22:50:30+08:00",
			creator: { username: "curator", nickname: "Curator" },
			summary: "",
			data: {
				"46": { name: "A", infobox: "{{Infobox Crt\n|name=Earlier\n}}", summary: "", extra: {} },
			},
		};
		expect(selectBangumiRevisionWiki(revision).status).toBe("selection_required");
		expect(selectBangumiRevisionWiki(revision, "46")).toMatchObject({
			status: "available",
			path: "/data/46/infobox",
			wiki: { entries: [{ key: "name", value: "Earlier" }] },
		});
		expect(selectBangumiRevisionWiki({ ...revision, data: null }).status).toBe("unavailable");
		expect(selectBangumiRevisionWiki(revision, "77").status).toBe("unavailable");
	});
	it("treats index curator handles as external attribution while retaining source statistics", () => {
		const index = BangumiIndexSchema.parse({
			id: 1,
			title: "Index",
			desc: "",
			created_at: "2010-06-05T20:36:14+08:00",
			updated_at: "2025-05-09T22:20:08+08:00",
			creator: { username: "curator", nickname: "Curator" },
			total: 9,
			stat: { comments: 2, collects: 16 },
			nsfw: false,
			ban: false,
		});
		expect(index.creator).toEqual({ username: "curator", nickname: "Curator" });
		expect(index.stat.collects).toBe(16);
	});
	it("keeps source sort, episode number, source duration, and server duration separately", () => {
		const result = planBangumiEpisode(episode);
		expect(result.episode.sort).toBe(1.5);
		expect(result.episode.ep).toBe(2);
		expect(result.episode.duration).toBe("00:24:43");
		expect(result.lengthMilliseconds).toBe(1_483_000);
		expect(planBangumiEpisode({ ...episode, duration_seconds: 0, airdate: "TBA" })).toMatchObject({
			lengthMilliseconds: null,
			date: null,
		});
	});
	it("preserves declared-null profile data even when the wiki disagrees", () => {
		const person = BangumiPersonSchema.parse({
			...profile,
			career: ["seiyu"],
			img: "",
			last_modified: "0001-01-01T00:00:00Z",
		});
		expect(person.blood_type).toBeNull();
		expect(person.infobox?.[0]?.value).toBe("A");
		expect(person.last_modified).toBe("0001-01-01T00:00:00Z");
		expect(BangumiCharacterSchema.parse({ ...profile, nsfw: false }).nsfw).toBe(false);
	});
	it("preserves repeated wiki keys and repeated list entries in source order", () => {
		const wiki =
			"{{Infobox animanga/Anime\r\n|alias={\r\n[a]\r\n[edition|a]\r\n[v]]\r\n}\r\n|alias=other\r\n}}";
		const parsed = parseBangumiWiki(wiki);
		expect(parsed).toEqual({
			status: "parsed",
			raw: wiki,
			type: "animanga/Anime",
			entries: [
				{ key: "alias", value: [{ v: "a" }, { k: "edition", v: "a" }, { v: "v]" }] },
				{ key: "alias", value: "other" },
			],
		});
		expect(parseBangumiWiki("{{Infobox\n|x={\n[oops\n}\n}}").status).toBe("unparsed");
	});
	it("voice credits retain the subject in their identity; archive flags retain explicit false", () => {
		const row = {
			kind: "person-characters" as const,
			subject_id: 253,
			person_id: 3914,
			character_id: 77,
			summary: "",
		};
		expect(bangumiRelationKey(row)).not.toBe(bangumiRelationKey({ ...row, subject_id: 254 }));
		expect(
			BangumiArchiveRelationSchema.parse({
				kind: "person-relations",
				person_type: "crt",
				person_id: 77,
				related_person_id: 78,
				relation_type: 1001,
				spoiler: false,
				ended: 0,
			}),
		).toMatchObject({ spoiler: false, ended: 0 });
	});
	it("rejects silent contract drift and inconsistent native season ownership", () => {
		expect(() => planBangumiEpisode({ ...episode, future: true })).toThrow();
		expect(() =>
			ProgramStructureSchema.parse({
				shape: "episode",
				fields: { seasonId: "01900000-0000-7000-8000-000000000001" },
			}),
		).toThrow();
		expect(ProgramStructureSchema.parse({ shape: "program_version", fields: {} })).toMatchObject({
			fields: { programId: null },
		});
	});
});
