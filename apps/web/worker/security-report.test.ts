import { describe, expect, it, vi } from "vitest";

import {
	handleSecurityReportRequest,
	MaximumSecurityReportBytes,
	summarizeSecurityReports,
} from "./security-report";

describe("browser security-policy reports", () => {
	it("keeps only bounded operational fields and removes URL queries and samples", () => {
		expect(
			summarizeSecurityReports([
				{
					type: "csp-violation",
					url: "https://www.example.test/zone/private?secret=value",
					body: {
						blockedURL: "https://cdn.example/theme.js?token=secret",
						effectiveDirective: "script-src-elem",
						sample: "secret source text",
					},
				},
			]),
		).toEqual([
			{
				type: "csp-violation",
				documentUrl: "https://www.example.test/zone/private",
				blockedUrl: "https://cdn.example/theme.js",
				effectiveDirective: "script-src-elem",
			},
		]);
	});

	it("accepts modern reports without retaining request credentials", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const response = await handleSecurityReportRequest(
			new Request("https://www.example.test/__rezics/security-report", {
				method: "POST",
				headers: {
					"content-type": "application/reports+json",
					cookie: "session=must-not-be-logged",
				},
				body: JSON.stringify([{ type: "integrity-violation", body: { destination: "script" } }]),
			}),
		);
		expect(response.status).toBe(204);
		expect(warning).toHaveBeenCalledOnce();
		expect(String(warning.mock.calls[0]?.[0])).not.toContain("must-not-be-logged");
	});

	it("rejects oversized and malformed payloads", async () => {
		const oversized = await handleSecurityReportRequest(
			new Request("https://www.example.test/__rezics/security-report", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"content-length": String(MaximumSecurityReportBytes + 1),
				},
				body: "{}",
			}),
		);
		expect(oversized.status).toBe(413);
		const malformed = await handleSecurityReportRequest(
			new Request("https://www.example.test/__rezics/security-report", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "not json",
			}),
		);
		expect(malformed.status).toBe(400);
	});
});
