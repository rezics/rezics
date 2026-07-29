import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateReportBody,
	ListMyReportsQuery,
	MyReportListResponse,
	MyReportResponse,
} from "./schema";

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

	it("accepts cursor pagination for the current user's reports", () => {
		expect(
			Check(ListMyReportsQuery, {
				cursor: "opaque",
				limit: 30,
				reportId: "019b76da-a800-7300-8000-000000000001",
			}),
		).toBe(true);
		expect(Check(ListMyReportsQuery, { cursor: "", limit: 30 })).toBe(false);
		expect(Check(ListMyReportsQuery, { limit: 101 })).toBe(false);
	});

	it("keeps unavailable report targets opaque", () => {
		const report = {
			id: "019b76da-a800-7300-8000-000000000001",
			scope: "platform",
			status: "reviewing",
			target: { state: "unavailable" },
			rule: { language: "en", title: "No harassment" },
			details: null,
			createdAt: "2026-07-29T10:11:12.345Z",
		};

		expect(Check(MyReportResponse, report)).toBe(true);
		expect(
			Check(MyReportResponse, {
				...report,
				target: {
					state: "unavailable",
					unit: { id: "019b76da-a800-7300-8000-000000000002" },
				},
			}),
		).toBe(false);
		expect(Check(MyReportListResponse, { items: [report], nextCursor: null })).toBe(true);
	});
});
