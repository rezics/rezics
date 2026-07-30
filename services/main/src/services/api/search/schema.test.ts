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
});
