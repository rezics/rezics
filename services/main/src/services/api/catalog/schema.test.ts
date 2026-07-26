import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	AddUnitCreditBody,
	AddUnitSubjectAssociationBody,
	UpdateEntityAssociationPolicyBody,
} from "./schema";

const UnitId = "019b76da-a800-7300-8000-000000000001";

describe("Entity association API contracts", () => {
	it("updates credit and subject association policies independently", () => {
		expect(Check(UpdateEntityAssociationPolicyBody, { subjectAssociation: "closed" })).toBe(
			true,
		);
		expect(
			Check(UpdateEntityAssociationPolicyBody, {
				creditAttribution: "approval",
			}),
		).toBe(true);
		expect(
			Check(UpdateEntityAssociationPolicyBody, {
				creditAttribution: "invite_only",
			}),
		).toBe(true);
		expect(Check(UpdateEntityAssociationPolicyBody, {})).toBe(false);
		expect(Check(UpdateEntityAssociationPolicyBody, { subjectAttribution: "closed" })).toBe(
			false,
		);
	});

	it("accepts only registered credit and subject roles", () => {
		expect(
			Check(AddUnitCreditBody, {
				creditedUnitId: UnitId,
				role: "author",
			}),
		).toBe(true);
		expect(
			Check(AddUnitCreditBody, {
				creditedUnitId: UnitId,
				role: "arbitrary-credit",
			}),
		).toBe(false);
		expect(
			Check(AddUnitSubjectAssociationBody, {
				entityId: UnitId,
				contextPostId: "019f73cb-926e-7e50-9a7f-da67701accb4",
				role: "primary_character",
			}),
		).toBe(true);
		expect(
			Check(AddUnitSubjectAssociationBody, {
				entityId: UnitId,
				contextPostId: "019f73cb-926e-7e50-9a7f-da67701accb4",
				role: "arbitrary-subject",
			}),
		).toBe(false);
		expect(
			Check(AddUnitSubjectAssociationBody, {
				entityId: UnitId,
				role: "primary_character",
			}),
		).toBe(true);
	});
});
