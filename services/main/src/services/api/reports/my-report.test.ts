import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../../pagination/errors";
import {
	decodeMyReportCursor,
	encodeMyReportCursor,
	toAggregateMyReportStatus,
	toMyReportStatus,
} from "./my-report";

describe("current-user report projection", () => {
	it("round-trips a stable report cursor", () => {
		const boundary = {
			createdAt: new Date("2026-07-29T10:11:12.345Z"),
			id: "019b76da-a800-7300-8000-000000000001",
		};

		expect(decodeMyReportCursor(encodeMyReportCursor(boundary))).toEqual(boundary);
	});

	it.each(["not-base64", Buffer.from("{}").toString("base64url")])(
		"rejects invalid cursor %s",
		(value) => {
			expect(() => decodeMyReportCursor(value)).toThrow(InvalidPaginationCursor);
		},
	);

	it.each([
		["new", "submitted"],
		["triaged", "reviewing"],
		["assigned", "reviewing"],
		["escalated", "reviewing"],
		["reviewing", "reviewing"],
		["actioned", "completed"],
		["resolved", "completed"],
		["duplicate", "merged"],
		["rejected", "not_actioned"],
	] as const)("maps %s to the public %s state", (state, expected) => {
		expect(toMyReportStatus(state)).toBe(expected);
	});

	it("aggregates independent referral outcomes without hiding active review", () => {
		expect(toAggregateMyReportStatus(["resolved", "reviewing"])).toBe("reviewing");
		expect(toAggregateMyReportStatus(["resolved", "rejected"])).toBe("completed");
		expect(toAggregateMyReportStatus(["duplicate", "duplicate"])).toBe("merged");
		expect(toAggregateMyReportStatus(["duplicate", "rejected"])).toBe("not_actioned");
	});
});
