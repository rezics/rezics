import { describe, expect, it } from "vitest";

import { OfficialRuleInitialRevision } from "./initial-revision";

describe("official Rule Realm initial Seed", () => {
	it("contains the bounded starter publication without fixed online identities", () => {
		expect(OfficialRuleInitialRevision.rules).toHaveLength(11);
		expect(OfficialRuleInitialRevision.rules.at(-1)?.localizations).toEqual([
			expect.objectContaining({ language: "zh", title: "網址與命名空間完整性" }),
			expect.objectContaining({
				language: "en",
				title: "Address and namespace integrity",
			}),
		]);
		for (const rule of OfficialRuleInitialRevision.rules) {
			expect(rule).not.toHaveProperty("id");
			expect(new Set(rule.localizations.map(({ language }) => language)).size).toBe(
				rule.localizations.length,
			);
		}
	});
});
