import { describe, expect, it } from "vitest";

import { canAccessContentStructureApi } from "./release";

describe("Content Structure API release policy", () => {
	it("requires the staff preview capability for Media and Software", () => {
		expect(canAccessContentStructureApi("media", false)).toBe(false);
		expect(canAccessContentStructureApi("software", false)).toBe(false);
		expect(canAccessContentStructureApi("media", true)).toBe(true);
		expect(canAccessContentStructureApi("software", true)).toBe(true);
	});

	it("does not put released Unit kinds behind the preview capability", () => {
		expect(canAccessContentStructureApi("book", false)).toBe(true);
		expect(canAccessContentStructureApi("post", false)).toBe(true);
	});
});
