import { describe, expect, it } from "vitest";

import { zoneHomeSearchHref } from "./zone-search-entry";

describe("Zone search addresses", () => {
	it("points the Zone-scoped header search at the dedicated search route", () => {
		expect(zoneHomeSearchHref("/z/light-novel")).toBe("/z/light-novel/search");
		expect(zoneHomeSearchHref("/zone/019f9000-0000-7000-8000-000000000001")).toBe(
			"/zone/019f9000-0000-7000-8000-000000000001/search",
		);
	});
});
