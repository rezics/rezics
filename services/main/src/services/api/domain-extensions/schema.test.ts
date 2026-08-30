import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateSeriesBody,
	SystemRequirementResponse,
	UpdateZoneBody,
	ZoneRenderQuery,
} from "./schema";

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

describe("Series License input", () => {
	const input = {
		kind: "franchise",
		licenses: ["cc-by-4.0", "rezics-unit-content-license-v1-1"],
		localization: {
			language: "en",
			title: "Example Series",
			coverAssetId: null,
		},
	};

	it("uses the same registered License array as every other Unit", () => {
		expect(Check(CreateSeriesBody, input)).toBe(true);
		expect(Check(CreateSeriesBody, { ...input, licenses: ["custom terms"] })).toBe(false);
		expect(Check(CreateSeriesBody, { kind: input.kind, localization: input.localization })).toBe(
			false,
		);
	});
});

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

describe("Zone local Rule Realm contract", () => {
	it("accepts a Realm identity or an explicit reset", () => {
		const realmId = "019b76da-a800-7300-8000-000000000001";
		expect(Check(UpdateZoneBody, { localRuleRealmId: realmId })).toBe(true);
		expect(Check(UpdateZoneBody, { localRuleRealmId: null })).toBe(true);
		expect(Check(UpdateZoneBody, { localRuleRealmId: "not-a-realm-id" })).toBe(false);
	});
});
