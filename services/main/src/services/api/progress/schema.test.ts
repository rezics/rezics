import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CompleteProgressBody, UpsertProgressBody } from "./schema";

describe("progress API contract", () => {
	it("keeps completion count outside ordinary progress updates", () => {
		expect(
			Check(UpsertProgressBody, {
				status: "active",
				progress: 0.4,
				lastContentStructureNodeId: null,
			}),
		).toBe(true);
		expect(
			Check(UpsertProgressBody, {
				status: "completed",
				progress: 1,
				completedCount: 3,
			}),
		).toBe(false);
	});

	it("allows completion to retain an updated cumulative time", () => {
		expect(Check(CompleteProgressBody, {})).toBe(true);
		expect(Check(CompleteProgressBody, { totalTimeMs: 3_600_000 })).toBe(true);
		expect(Check(CompleteProgressBody, { totalTimeMs: -1 })).toBe(false);
	});
});
