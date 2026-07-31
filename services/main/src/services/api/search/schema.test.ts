import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DomainSearchBody, GroupedSearchBody } from "./schema";

describe("Search presentation localization", () => {
	it.each([DomainSearchBody, GroupedSearchBody])(
		"requires a non-empty localization priority",
		(schema) => {
			expect(Check(schema, { localizationLanguages: ["zh", "en"] })).toBe(true);
			expect(Check(schema, {})).toBe(false);
			expect(Check(schema, { localizationLanguages: [] })).toBe(false);
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
});
