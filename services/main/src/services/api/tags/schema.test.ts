import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { UnitTagLandscapeQuery, UpsertRealmTagSubscriptionBody } from "./schema";

describe("Tag API schemas", () => {
	it("bounds personalized landscape sizes", () => {
		expect(
			Value.Check(UnitTagLandscapeQuery, {
				globalLimit: 100,
				sourceLimit: 30,
				perRealmLimit: 50,
			}),
		).toBe(true);
		expect(Value.Check(UnitTagLandscapeQuery, { sourceLimit: 31 })).toBe(false);
	});

	it("accepts an omitted position or a valid fractional position", () => {
		expect(Value.Check(UpsertRealmTagSubscriptionBody, {})).toBe(true);
		expect(Value.Check(UpsertRealmTagSubscriptionBody, { position: "a0" })).toBe(true);
		expect(Value.Check(UpsertRealmTagSubscriptionBody, { position: "" })).toBe(false);
	});
});
