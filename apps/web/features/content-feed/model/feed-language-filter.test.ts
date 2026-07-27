import { describe, expect, it } from "vitest";

import { resolveFeedFilterLanguages } from "./feed-language-filter";

describe("resolveFeedFilterLanguages", () => {
	it("applies the ordered preferred-language list as the initial Feed default", () => {
		expect(
			resolveFeedFilterLanguages({
				allowDefault: true,
				defaultInitialized: false,
				filterByPreferredLanguages: true,
				preferredLanguages: ["zh", "en"],
				requestedLanguages: [],
			}),
		).toEqual(["zh", "en"]);
	});

	it("preserves an explicit Feed filter", () => {
		expect(
			resolveFeedFilterLanguages({
				allowDefault: true,
				defaultInitialized: false,
				filterByPreferredLanguages: true,
				preferredLanguages: ["zh"],
				requestedLanguages: ["en"],
			}),
		).toEqual(["en"]);
	});

	it("allows the user to clear the default after initialization", () => {
		expect(
			resolveFeedFilterLanguages({
				allowDefault: true,
				defaultInitialized: true,
				filterByPreferredLanguages: true,
				preferredLanguages: ["zh"],
				requestedLanguages: [],
			}),
		).toEqual([]);
	});
});
