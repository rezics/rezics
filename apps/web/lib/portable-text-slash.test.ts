import { parsePortableTextSlashToken } from "@rezics/ui/custom/portable-text-slash";
import { describe, expect, it } from "vitest";

describe("parsePortableTextSlashToken", () => {
	it.each(["u", "t", "e", "r", "z"] as const)("accepts the %s/ unit mention prefix", (prefix) => {
		expect(parsePortableTextSlashToken(`before ${prefix}/query words`)).toEqual({
			kind: "mention",
			prefix,
			query: "query words",
			start: 7,
			end: 20,
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
