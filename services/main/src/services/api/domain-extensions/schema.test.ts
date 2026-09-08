import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import { UpdateZoneBody, ZoneRenderQuery } from "./schema";

describe("Zone render query", () => {
	it("accepts a Post ID as a render-reference context", () => {
		expect(
			Check(ZoneRenderQuery, {
				postId: "019b76da-a800-7300-8000-000000000001",
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
		expect(Check(ZoneRenderQuery, { postId: "not-a-unit-id" })).toBe(false);
	});
});

describe("Zone local Rule Realm contract", () => {
	it("accepts a Realm identity or an explicit reset", () => {
		const realmId = "019b76da-a800-7300-8000-000000000001";
		expect(Check(UpdateZoneBody, { localRuleRealmId: realmId })).toBe(true);
		expect(Check(UpdateZoneBody, { localRuleRealmId: null })).toBe(true);
		expect(Check(UpdateZoneBody, { localRuleRealmId: "not-a-realm-id" })).toBe(false);
	});
});
