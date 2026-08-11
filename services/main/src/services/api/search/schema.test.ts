import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DomainSearchBody, GroupedSearchBody } from "./schema";

describe("Search presentation localization", () => {
	it.each([DomainSearchBody, GroupedSearchBody])(
		"accepts omitted or empty localization hints",
		(schema) => {
			expect(Check(schema, { localizationLanguages: ["zh", "en"] })).toBe(true);
			expect(Check(schema, {})).toBe(true);
			expect(Check(schema, { localizationLanguages: [] })).toBe(true);
			expect(Check(schema, { localizationLanguages: ["en", "en"] })).toBe(false);
		},
	);

	it("requires a UUID for Realm Tag Context scoping", () => {
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				realmTagContextRealmId: "019b0000-0000-7000-8000-000000000002",
			}),
		).toBe(true);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				realmTagContextRealmId: "not-a-realm",
			}),
		).toBe(false);
	});

	it("accepts only canonical content ratings", () => {
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["general", "r15", "r18"],
			}),
		).toBe(true);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["r18", "r18"],
			}),
		).toBe(false);
		expect(
			Check(DomainSearchBody, {
				localizationLanguages: ["zh", "en"],
				contentRatings: ["adult"],
			}),
		).toBe(false);
	});
});
