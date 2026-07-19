import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { UpdateEntityAssociationPolicyBody } from "./schema";

describe("Entity association API contracts", () => {
	it("updates credit and subject association policies independently", () => {
		expect(Check(UpdateEntityAssociationPolicyBody, { subjectAssociation: "closed" })).toBe(
			true,
		);
		expect(
			Check(UpdateEntityAssociationPolicyBody, {
				creditAttribution: "owner_only",
			}),
		).toBe(true);
		expect(Check(UpdateEntityAssociationPolicyBody, {})).toBe(false);
		expect(Check(UpdateEntityAssociationPolicyBody, { subjectAttribution: "closed" })).toBe(
			false,
		);
	});
});
