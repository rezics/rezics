import {
	parsePortableTextSlashToken,
	portableTextMentionSearchCategory,
} from "@rezics/ui/custom/portable-text-slash";
import { describe, expect, it } from "vitest";

describe("parsePortableTextSlashToken", () => {
	it.each([
		["u", "users"],
		["t", "tags"],
		["e", "entity"],
		["r", "realms"],
		["z", "units"],
	] as const)("maps %s/ to the %s search category", (prefix, category) => {
		expect(portableTextMentionSearchCategory(prefix)).toBe(category);
	});

	it.each(["u", "t", "e", "r", "z"] as const)("accepts the %s/ unit mention prefix", (prefix) => {
		expect(parsePortableTextSlashToken(`before ${prefix}/query words`)).toEqual({
			kind: "mention",
			prefix,
			query: "query words",
			start: 7,
			end: 20,
		});
	});

	it("keeps a Chinese mention query intact", () => {
		expect(parsePortableTextSlashToken("before u/繁體中文")).toEqual({
			kind: "mention",
			prefix: "u",
			query: "繁體中文",
			start: 7,
			end: 13,
		});
	});

	it("accepts Notion-style block commands only at the start of a block", () => {
		expect(parsePortableTextSlashToken("/heading")).toEqual({
			kind: "block",
			query: "heading",
			start: 0,
			end: 8,
		});
		expect(parsePortableTextSlashToken("before /heading")).toBeNull();
	});

	it.each(["@someone", "x/query", "uu/query", "wordu/query"])(
		"rejects unsupported mention syntax %s",
		(value) => {
			expect(parsePortableTextSlashToken(value)).toBeNull();
		},
	);
});
