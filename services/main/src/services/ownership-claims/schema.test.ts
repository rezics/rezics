import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateUnitOwnershipClaimBody, DecideUnitOwnershipClaimBody } from "./schema";

const unitId = "019b76da-a800-7300-8000-000000000001";

describe("Unit ownership claim API contracts", () => {
	it("requires a nonblank ownership basis", () => {
		expect(
			Check(CreateUnitOwnershipClaimBody, {
				unitId,
				details: "I am the author; supporting source: https://example.com/about",
			}),
		).toBe(true);
		expect(Check(CreateUnitOwnershipClaimBody, { unitId, details: "   " })).toBe(false);
		expect(Check(CreateUnitOwnershipClaimBody, { unitId, details: "x".repeat(2_001) })).toBe(
			false,
		);
	});

	it("requires an explicit claim id confirmation for a platform decision", () => {
		expect(
			Check(DecideUnitOwnershipClaimBody, {
				decision: "approved",
				confirmationClaimId: unitId,
				reasonCode: "administrative",
			}),
		).toBe(true);
		expect(
			Check(DecideUnitOwnershipClaimBody, {
				decision: "approved",
				reasonCode: "administrative",
			}),
		).toBe(false);
		expect(
			Check(DecideUnitOwnershipClaimBody, {
				decision: "superseded",
				confirmationClaimId: unitId,
				reasonCode: "administrative",
			}),
		).toBe(false);
	});
});
