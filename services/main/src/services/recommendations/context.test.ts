import { describe, expect, it } from "vitest";

import { resolvePersonalization, resolveRecommendationViewer } from "./context";

describe("resolvePersonalization", () => {
	it("defaults signed-in viewers to personalized recommendations", () => {
		expect(resolvePersonalization(undefined, undefined)).toBe(true);
	});

	it("allows a request to temporarily disable personalization", () => {
		expect(resolvePersonalization(true, false)).toBe(false);
	});

	it("does not let a request bypass a disabled account preference", () => {
		expect(resolvePersonalization(false, true)).toBe(false);
	});
});

describe("resolveRecommendationViewer", () => {
	it("uses the safe content-rating default for anonymous viewers", async () => {
		expect((await resolveRecommendationViewer(undefined)).contentRatings).toEqual([
			"general",
			"r15",
		]);
	});
});
