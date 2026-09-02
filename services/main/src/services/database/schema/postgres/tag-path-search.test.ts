import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

let source = "";

beforeAll(async () => {
	source = await readFile(new URL("./tag-path-search.sql", import.meta.url), "utf8");
});

describe("Tag suggestion PostgreSQL search contract", () => {
	it("ranks a fixed Tag-only candidate window by PGroonga score", () => {
		expect(source).toContain("FUNCTION public.search_tag_suggestion_candidates");
		expect(source).toContain("'sort_keys', '-_score,-search_order_key'");
		expect(source).toContain("'output_columns', '_score,search_order_key'");
		expect(source).toContain("p_limit > 80");
		expect(source).toContain("estimated_postings > p_estimated_postings_limit");
	});

	it("does not substitute unrelated recent Tags when the posting budget is exceeded", () => {
		const functionStart = source.indexOf("FUNCTION public.search_tag_suggestion_candidates");
		const functionEnd = source.indexOf("REVOKE ALL ON FUNCTION", functionStart);
		const suggestionFunction = source.slice(functionStart, functionEnd);
		expect(suggestionFunction).toContain("IF estimated_postings > p_estimated_postings_limit THEN");
		expect(suggestionFunction).not.toContain("FROM public.unit AS candidate");
	});

	it("keeps the definer function private", () => {
		expect(source).toContain(
			"REVOKE ALL ON FUNCTION public.search_tag_suggestion_candidates(\n    text, text[], integer, integer\n) FROM PUBLIC;",
		);
	});
});
