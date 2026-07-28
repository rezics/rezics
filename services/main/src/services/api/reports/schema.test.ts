import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateReportBody } from "./schema";

describe("Unit report API contract", () => {
	it("accepts a reason and plain unlocalized details", () => {
		expect(
			Check(CreateReportBody, {
				reason: "realm_rules",
				details: "The Unit violates rule 3.",
			}),
		).toBe(true);
		expect(
			Check(CreateReportBody, {
				reason: "realm_rules",
				language: "en",
				content: [],
			}),
		).toBe(false);
	});

	it("rejects blank and oversized details", () => {
		expect(Check(CreateReportBody, { reason: "spam", details: "" })).toBe(false);
		expect(Check(CreateReportBody, { reason: "spam", details: "x".repeat(2_001) })).toBe(false);
	});
});
