import { describe, expect, it } from "vitest";
import { SearchFieldValues, SearchSortValues } from "@rezics/filter";

import { CurrentSearchFieldRegistry, CurrentSearchSortRegistry } from "./field-registry";
import { SearchFieldByDomainRequestFilter } from "./schema";

describe("Search field capability contract", () => {
	it("describes every public Search field exactly once", () => {
		expect(Object.keys(CurrentSearchFieldRegistry).sort()).toEqual(
			[...SearchFieldValues].sort(),
		);
	});

	it("describes every public Search sort exactly once", () => {
		expect(Object.keys(CurrentSearchSortRegistry).sort()).toEqual([...SearchSortValues].sort());
	});

	it("maps every Domain Search adapter property to a described field", () => {
		for (const field of Object.values(SearchFieldByDomainRequestFilter))
			expect(CurrentSearchFieldRegistry[field]).toBeDefined();
	});

	it("advertises no supported sort without a physical ordering source", () => {
		for (const definition of Object.values(CurrentSearchSortRegistry)) {
			if (!definition.categories.length) continue;
			expect(definition.candidateSource).not.toBeNull();
			expect(definition.orderingIndexes.length).toBeGreaterThan(0);
		}
	});
});
