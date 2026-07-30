import { describe, expect, it } from "vitest";

import { canAccessContentStructureApi } from "./release";

describe("Content Structure API release policy", () => {
	it("requires development preview access for Software", () => {
		expect(canAccessContentStructureApi("software", false)).toBe(false);
		expect(canAccessContentStructureApi("software", true)).toBe(true);
	});

	it("does not put released Unit kinds behind the preview capability", () => {
		expect(canAccessContentStructureApi("book", false)).toBe(true);
		expect(canAccessContentStructureApi("media", false)).toBe(true);
		expect(canAccessContentStructureApi("post", false)).toBe(true);
	});
});
