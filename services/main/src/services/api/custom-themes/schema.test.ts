import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { DecideCustomThemeRevisionBody } from "./schema";

const approval = {
	decision: "approve",
	hostUnitId: "019f9000-0000-7000-8000-000000000001",
	owner: "Theme team",
	incidentContact: "On-call theme owner",
	licenseFindings: [],
	acknowledgedRisks: ["Reviewed full-trust and mutable remote-code risk"],
} as const;

describe("Custom Theme decision schema", () => {
	it("accepts human findings without accepting server-generated render evidence", () => {
		expect(Value.Check(DecideCustomThemeRevisionBody, approval)).toBe(true);
		expect(
			Value.Check(DecideCustomThemeRevisionBody, {
				...approval,
				referenceRender: {
					rendererVersion: "reviewer-entered",
					fixtures: [],
				},
			}),
		).toBe(false);
	});
});
