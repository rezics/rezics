import { describe, expect, it } from "vitest";

import { CurrentSearchFieldRegistry } from "./field-registry";
import { SearchCategories, SearchCategoryRules, SearchFieldByFilterableAttribute } from "./schema";

describe("Search field capability contract", () => {
	it("supports every filter combination exposed by the Domain Search API", () => {
		for (const category of SearchCategories)
			for (const attribute of SearchCategoryRules[category].filterableAttributes) {
				const field = SearchFieldByFilterableAttribute[attribute];
				expect(
					CurrentSearchFieldRegistry[field]?.categories,
					`${category}.${attribute} maps to unsupported Search field ${field}`,
				).toContain(category);
			}
	});
});
