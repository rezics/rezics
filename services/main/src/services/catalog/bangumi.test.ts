import { describe, expect, it } from "vitest";
import {
	BangumiSubjectFieldOwners,
	BangumiSubjectSchema,
	bangumiDate,
	planBangumiSubject,
} from "./bangumi";

function subject(type: 1 | 2 | 3 | 4 | 6 = 2) {
	return {
		id: 253,
		type,
		name: "Fixture title",
		name_cn: "校验条目",
		summary: "",
		series: false,
		nsfw: false,
		locked: false,
		date: "1998-10-23",
		platform: "TV",
		images: { small: "", grid: "", large: "", medium: "", common: "" },
		infobox: [{ key: "alias", value: [{ v: "one" }, { k: "edition", v: "two" }] }],
		volumes: 0,
		eps: 26,
		total_episodes: 31,
		rating: {
			rank: 4,
			total: 2,
			score: 9,
			count: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 2, "10": 0 },
		},
		collection: { wish: 1, collect: 2, doing: 0, on_hold: 0, dropped: 0 },
		tags: [],
		meta_tags: [],
	};
}

describe("Bangumi public catalog projection plan", () => {
	it("keeps episode metrics and ordered wiki values distinct", () => {
		const plan = planBangumiSubject(subject());
		expect([plan.subject.eps, plan.subject.total_episodes]).toEqual([26, 31]);
		expect(plan.subject.infobox?.[0]?.value).toEqual([{ v: "one" }, { k: "edition", v: "two" }]);
		expect(plan.names.map(({ languageTag }) => languageTag)).toEqual([null, "zh"]);
	});
	it("does not turn arbitrary games into VNs or ambiguous book/music subjects into Works", () => {
		expect(planBangumiSubject(subject(4)).shape).toBe("content");
		expect(planBangumiSubject(subject(1)).shape).toBe("catalog_entry");
		expect(planBangumiSubject(subject(3)).shape).toBe("catalog_entry");
		expect(planBangumiSubject({ ...subject(1), series: true }).owner).toBe("grouping");
	});
	it("rejects unreviewed new fields rather than silently dropping them", () => {
		expect(() => planBangumiSubject({ ...subject(), future_required_field: 1 })).toThrow();
		expect(Object.keys(BangumiSubjectFieldOwners).sort()).toEqual(
			Object.keys(BangumiSubjectSchema.shape).sort(),
		);
	});
	it("does not turn unknown date precision into a complete date", () => {
		expect(bangumiDate("2020")).toEqual({ year: 2020, month: null, day: null });
		expect(bangumiDate("2020-02")).toEqual({ year: 2020, month: 2, day: null });
		expect(bangumiDate("1900-02-29")).toBeNull();
		expect(bangumiDate("TBA")).toBeNull();
	});
});
