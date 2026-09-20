import { describe, expect, it } from "vitest";
import { JoinRealmSchema, RealmRuleConsentSchema } from "./membership-contracts";

const expected = {
	operationId: "019f94d1-c8ca-7110-b984-b0614ba4db9d",
	expectedControlRevision: 1,
	expectedRevision: 0,
	expectedMembershipVersion: 0,
	expectedEnforcementRevision: 0,
};

describe("Realm membership requires explicit consent", () => {
	it("requires consent and an exact rule selection even when an older policy described implicit following", () => {
		const request = { ...expected, ruleRevisionId: null };
		expect(JoinRealmSchema.safeParse(request).success).toBe(false);
		expect(JoinRealmSchema.safeParse({ ...request, consent: false }).success).toBe(false);
		expect(JoinRealmSchema.parse({ ...request, consent: true }).consent).toBe(true);
		expect(
			JoinRealmSchema.safeParse({ ...request, acknowledgementMode: "implicit_on_follow" }).success,
		).toBe(false);
	});

	it("keeps rule acknowledgement separate and requires current enrollment preconditions", () => {
		const request = {
			...expected,
			expectedMembershipVersion: 3,
			expectedRevision: 2,
			consent: true,
			language: null,
		};
		expect(RealmRuleConsentSchema.safeParse(request).success).toBe(true);
		expect(RealmRuleConsentSchema.safeParse({ ...request, consent: undefined }).success).toBe(
			false,
		);
		expect(
			RealmRuleConsentSchema.safeParse({ ...request, expectedMembershipVersion: undefined })
				.success,
		).toBe(false);
		expect(
			RealmRuleConsentSchema.safeParse({ ...request, profileId: expected.operationId }).success,
		).toBe(false);
	});
});
