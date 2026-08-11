import { describe, expect, it } from "vitest";

import {
	CanonicalPgroongaIndexes,
	parseSearchIndexOptions,
	quoteCanonicalPgroongaIndex,
	SearchIndexConfigurationError,
	selectCanonicalPgroongaIndexes,
} from "./search-index-support";

describe("PGroonga index lifecycle support", () => {
	it("defaults health checks to the complete canonical inventory", () => {
		expect(parseSearchIndexOptions(["check"])).toEqual({
			action: "check",
			index: "all",
			confirmed: false,
		});
		expect(selectCanonicalPgroongaIndexes("all")).toEqual(CanonicalPgroongaIndexes);
	});

	it("accepts an allowlisted single index", () => {
		const options = parseSearchIndexOptions([
			"reindex-concurrently",
			"--index",
			"unit_localization_pgroonga_content_idx",
			"--yes",
		]);
		expect(options.index).toBe("unit_localization_pgroonga_content_idx");
		if (options.index === "all") throw new Error("Expected one canonical PGroonga index");
		expect(quoteCanonicalPgroongaIndex(options.index)).toBe(
			'public."unit_localization_pgroonga_content_idx"',
		);
	});

	it("rejects unknown indexes and unconfirmed maintenance", () => {
		expect(() => parseSearchIndexOptions(["check", "--index", "users_pkey"])).toThrow(TypeError);
		expect(() => parseSearchIndexOptions(["reindex"])).toThrow(SearchIndexConfigurationError);
	});
});
