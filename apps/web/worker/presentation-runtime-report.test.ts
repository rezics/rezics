import { describe, expect, it, vi } from "vitest";

import {
	handlePresentationRuntimeReportRequest,
	MaximumPresentationRuntimeReportBytes,
} from "./presentation-runtime-report";

const report = {
	contract: "rezics.unit.presentation@0",
	executionMode: "host_full_trust",
	hostUnitId: "019f9000-0000-7000-8000-000000000001",
	phase: "active",
	revisionId: "019f9000-0000-7000-8000-000000000002",
	durationMilliseconds: 125,
};

describe("presentation runtime telemetry", () => {
	it("records only the bounded structured contract", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
		const response = await handlePresentationRuntimeReportRequest(
			new Request("https://www.example.test/__rezics/presentation-runtime-report", {
				method: "POST",
				body: JSON.stringify(report),
			}),
		);
		expect(response.status).toBe(204);
		expect(info).toHaveBeenCalledOnce();
		expect(String(info.mock.calls[0]?.[0])).toContain('"phase":"active"');
	});

	it("rejects unknown fields, malformed identifiers, and oversized reports", async () => {
		const unknownField = await handlePresentationRuntimeReportRequest(
			new Request("https://www.example.test/__rezics/presentation-runtime-report", {
				method: "POST",
				body: JSON.stringify({ ...report, pageContents: "must not be recorded" }),
			}),
		);
		expect(unknownField.status).toBe(400);

		const invalidId = await handlePresentationRuntimeReportRequest(
			new Request("https://www.example.test/__rezics/presentation-runtime-report", {
				method: "POST",
				body: JSON.stringify({ ...report, revisionId: "not-a-uuid" }),
			}),
		);
		expect(invalidId.status).toBe(400);

		const oversized = await handlePresentationRuntimeReportRequest(
			new Request("https://www.example.test/__rezics/presentation-runtime-report", {
				method: "POST",
				headers: { "content-length": String(MaximumPresentationRuntimeReportBytes + 1) },
				body: "{}",
			}),
		);
		expect(oversized.status).toBe(413);
	});
});
