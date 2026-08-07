import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { SystemRequirementResponse, ZoneRenderQuery } from "./schema";

const requirement = {
	id: "019b76da-a800-7300-8000-000000000001",
	softwareId: "019b76da-a800-7300-8000-000000000002",
	platformEntityId: null,
	tier: "recommended",
	sourceExternalLinkId: null,
	hardware: {
		memory: "16 GB",
		storage: { amount: 50, unit: "GB" },
		features: ["ray tracing", "controller"],
	},
	createdAt: "2026-07-23T00:00:00.000Z",
	updatedAt: "2026-07-23T00:00:00.000Z",
};

describe("Software system requirement response", () => {
	it("preserves nested JSON hardware details", () => {
		expect(Check(SystemRequirementResponse, requirement)).toBe(true);
	});

	it("rejects non-JSON hardware values", () => {
		expect(
			Check(SystemRequirementResponse, {
				...requirement,
				hardware: { memory: undefined },
			}),
		).toBe(false);
	});
});

describe("Zone render query", () => {
	it("accepts a Post ID as a render-reference context", () => {
		expect(
			Check(ZoneRenderQuery, {
				postId: "019b76da-a800-7300-8000-000000000001",
				localizationLanguages: ["zh", "en"],
			}),
		).toBe(true);
		expect(Check(ZoneRenderQuery, { postId: "not-a-unit-id" })).toBe(false);
	});
});
