import { describe, expect, it } from "vitest";

import {
	MyReportsHref,
	myReportAnchorId,
	myReportHref,
	parseSelectedReportId,
} from "./report-routes";

describe("report routes", () => {
	it("keeps the report list at a stable top-level route", () => {
		expect(MyReportsHref).toBe("/reports");
	});

	it("links a report-resolution notification to its list item", () => {
		const reportId = "019b76da-a800-7300-8000-000000000001";
		expect(myReportAnchorId(reportId)).toBe(`report-${reportId}`);
		expect(myReportHref(reportId)).toBe(`/reports?reportId=${reportId}#report-${reportId}`);
		expect(parseSelectedReportId(reportId)).toBe(reportId);
	});

	it("ignores malformed or repeated selected-report parameters", () => {
		expect(parseSelectedReportId("not-a-report-id")).toBeUndefined();
		expect(parseSelectedReportId(["019b76da-a800-7300-8000-000000000001"])).toBeUndefined();
	});
});
