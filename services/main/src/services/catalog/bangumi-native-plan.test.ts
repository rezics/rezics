import { describe, expect, it } from "vitest";
import { planBangumiNativeNames, planBangumiProgramProjection } from "./bangumi-native-plan";
import {
	BangumiArchiveEpisodeSchema,
	BangumiEpisodeSchema,
	BangumiArchivePersonSchema,
} from "./bangumi-records";

const episode = {
	id: 1,
	subject_id: 2,
	type: 0,
	name: "Episode",
	name_cn: "",
	sort: 1.5,
	airdate: "2024-02",
	duration: "24m",
	description: "",
	disc: 0,
};
const programId = "00000000-0000-4000-8000-000000000001";

describe("Bangumi native source projection", () => {
	it("keeps API-only fields outside archive observations", () => {
		const projection = planBangumiProgramProjection(
			{ kind: "episode", archive: true, value: BangumiArchiveEpisodeSchema.parse(episode) },
			programId,
		);
		expect(projection?.observedFields).not.toContain("episodeNumber");
		expect(projection?.observedFields).not.toContain("lengthMilliseconds");
		expect(projection?.value.fields).toMatchObject({
			sortNumber: 1.5,
			discNumber: 0,
			date: { year: 2024, month: 2, day: null },
		});
	});
	it("preserves explicit API episode numbering and zero duration sentinel", () => {
		const { description: _, ...common } = episode;
		const projection = planBangumiProgramProjection(
			{
				kind: "episode",
				archive: false,
				value: BangumiEpisodeSchema.parse({
					...common,
					desc: "",
					comment: 0,
					ep: 0,
					duration_seconds: 0,
				}),
			},
			programId,
		);
		expect(projection?.observedFields).toContain("episodeNumber");
		expect(projection?.value.fields).toMatchObject({ episodeNumber: 0, lengthMilliseconds: null });
	});
	it("retains repeated wiki aliases as exact value occurrences", () => {
		const record = BangumiArchivePersonSchema.parse({
			id: 3,
			name: "Person",
			type: 1,
			career: [],
			summary: "",
			comments: 0,
			collects: 0,
			infobox: "{{Infobox person\n|别名=One\n|别名={\n[Two]\n[Three]\n}\n}}",
		});
		const names = planBangumiNativeNames({ kind: "person", archive: true, value: record });
		expect(names.map((name) => name.value.value)).toEqual(["Person", "One", "Two", "Three"]);
		expect(names.slice(1).map((name) => name.match)).toEqual(["value", "value", "value"]);
		expect(new Set(names.map((name) => name.path)).size).toBe(4);
	});
	it("does not interpret malformed wiki as aliases", () => {
		const record = BangumiArchivePersonSchema.parse({
			id: 3,
			name: "Person",
			type: 1,
			career: [],
			summary: "",
			comments: 0,
			collects: 0,
			infobox: "malformed |别名=wrong",
		});
		expect(planBangumiNativeNames({ kind: "person", archive: true, value: record })).toHaveLength(
			1,
		);
	});
	it("uses Chinese language evidence for a translated-only episode name", () => {
		const names = planBangumiNativeNames({
			kind: "episode",
			archive: true,
			value: BangumiArchiveEpisodeSchema.parse({ ...episode, name: "", name_cn: "序章" }),
		});
		expect(names[0]).toMatchObject({
			path: "/name_cn",
			value: { languageTag: "zh", value: "序章" },
		});
	});
});
