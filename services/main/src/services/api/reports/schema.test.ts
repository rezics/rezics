import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateReportBody } from "./schema";

describe("Unit report API contract", () => {
	const ruleRealmId = "019b76da-a800-7300-8000-000000000003";
	const ruleId = "019b76da-a800-7360-8000-000000000001";

	it("accepts one rule identity and plain unlocalized details", () => {
		expect(
			Check(CreateReportBody, {
				ruleRealmId,
				ruleId,
				details: "The Unit violates rule 3.",
			}),
		).toBe(true);
		expect(
			Check(CreateReportBody, {
				ruleRealmId,
				ruleId,
				ruleRevisionId: "019b76da-a800-7350-8000-000000000001",
			}),
		).toBe(false);
		expect(
			Check(CreateReportBody, {
				ruleRealmId,
				ruleId,
				language: "en",
				content: [],
			}),
		).toBe(false);
	});

	it("rejects blank and oversized details", () => {
		expect(Check(CreateReportBody, { ruleRealmId, ruleId, details: "" })).toBe(false);
		expect(
			Check(CreateReportBody, {
				ruleRealmId,
				ruleId,
				details: "x".repeat(2_001),
			}),
		).toBe(false);
	});
});
