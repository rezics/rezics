import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateReportBody,
	ListMyReportsQuery,
	MyReportListResponse,
	MyReportResponse,
	PlatformReportCaseResponse,
	ReportResponse,
} from "./schema";

const realmId = "019b76da-a800-7300-8000-000000000003";
const officialRealmId = "019b76da-a800-7300-8000-000000000004";
const revisionId = "019b76da-a800-7350-8000-000000000001";
const secondRevisionId = "019b76da-a800-7350-8000-000000000002";
const ruleId = "019b76da-a800-7360-8000-000000000001";
const secondRuleId = "019b76da-a800-7360-8000-000000000002";
const reportId = "019b76da-a800-7300-8000-000000000001";
const caseId = "019b76da-a800-7300-8000-000000000005";
const referralId = "019b76da-a800-7300-8000-000000000006";

const rules = [
	{ sourceRealmId: realmId, revisionId, ruleId },
	{
		sourceRealmId: officialRealmId,
		revisionId: secondRevisionId,
		ruleId: secondRuleId,
	},
] as const;

describe("Unit report API contract", () => {
	it("accepts multiple rules from multiple sources with plain reporter details", () => {
		expect(
			Check(CreateReportBody, {
				contextRealmId: realmId,
				rules,
				details: "The Unit violates two applicable rules.",
			}),
		).toBe(true);
		expect(
			Check(CreateReportBody, {
				rules: [{ sourceRealmId: realmId, ruleId }],
			}),
		).toBe(false);
		expect(
			Check(CreateReportBody, {
				ruleRealmId: realmId,
				ruleId,
			}),
		).toBe(false);
	});

	it("enforces bounded, unique rule references and reporter details", () => {
		expect(Check(CreateReportBody, { rules, details: "" })).toBe(false);
		expect(Check(CreateReportBody, { rules, details: "x".repeat(2_001) })).toBe(false);
		expect(Check(CreateReportBody, { rules: [rules[0], rules[0]] })).toBe(false);
		const tooManyRules = Array.from({ length: 33 }, (_, index) => ({
			sourceRealmId: realmId,
			revisionId,
			ruleId: `019b76da-a800-7360-8000-${String(index + 1).padStart(12, "0")}`,
		}));
		expect(Check(CreateReportBody, { rules: tooManyRules })).toBe(false);
	});

	it("accepts cursor pagination for the current user's reports", () => {
		expect(
			Check(ListMyReportsQuery, {
				cursor: "opaque",
				limit: 30,
				reportId,
			}),
		).toBe(true);
		expect(Check(ListMyReportsQuery, { cursor: "", limit: 30 })).toBe(false);
		expect(Check(ListMyReportsQuery, { limit: 101 })).toBe(false);
	});

	it("returns one submission with independent referrals to each authority", () => {
		const report = {
			id: reportId,
			unitId: "019b76da-a800-7300-8000-000000000007",
			contextRealmId: realmId,
			rules: [
				{
					id: ruleId,
					sourceRealmId: realmId,
					revisionId,
					language: "en",
					title: "No harassment",
				},
			],
			referrals: [
				{
					id: referralId,
					caseId,
					scope: "realm",
					realmId,
					caseState: "reviewing",
				},
				{
					id: "019b76da-a800-7300-8000-000000000008",
					caseId: "019b76da-a800-7300-8000-000000000009",
					scope: "platform",
					realmId: null,
					caseState: "new",
				},
			],
			details: null,
			reportedRevisionId: "019b76da-a800-7300-8000-000000000010",
			createdAt: "2026-07-29T10:11:12.345Z",
		};

		expect(Check(ReportResponse, report)).toBe(true);
	});

	it("keeps unavailable report targets opaque while exposing per-referral status", () => {
		const report = {
			id: reportId,
			status: "reviewing",
			target: { state: "unavailable" },
			rules: [
				{
					id: ruleId,
					sourceRealmId: realmId,
					revisionId,
					language: "en",
					title: "No harassment",
				},
			],
			referrals: [
				{
					id: referralId,
					caseId,
					scope: "realm",
					realmId,
					caseState: "reviewing",
					destinationTitle: "Readers",
					status: "reviewing",
				},
			],
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

	it("exposes only server-authoritative platform commands", () => {
		const item = {
			caseId,
			caseState: "new",
			unitId: "019b76da-a800-7300-8000-000000000007",
			unitKind: "post",
			language: "en",
			title: "Example",
			moderationStatus: "pending",
			postTargetingLocked: false,
			licenseGrants: [],
			reportCount: 2,
			allowedCommands: ["approve", "remove", "dismiss", "note"],
			createdAt: "2026-07-29T10:11:12.345Z",
			updatedAt: "2026-07-29T10:12:12.345Z",
		};

		expect(Check(PlatformReportCaseResponse, item)).toBe(true);
		expect(
			Check(PlatformReportCaseResponse, {
				...item,
				allowedCommands: ["ban_member"],
			}),
		).toBe(false);
	});
});
