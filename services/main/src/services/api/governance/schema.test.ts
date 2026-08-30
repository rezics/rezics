import { createPortableTextDocument } from "@rezics/block";
import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateAccountEnforcementBody,
	CreateContentGovernanceActionBody,
	CreateUnitAccessInvitationBody,
	CreateReviewedUnitMergeBody,
	OverrideUnitOwnershipBody,
	ReplaceUnitSubjectAccessBody,
	ReviewUnitMergeBody,
	RevokeAccountEnforcementBody,
	TransferUnitOwnershipBody,
	UpdateContentReviewCaseBody,
} from "./schema";

const profileId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const secondProfileId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d338";
const content = createPortableTextDocument([], "0123456789ab");
const internalNote = { language: "en", content };
const rule = {
	sourceRealmId: profileId,
	revisionId: secondProfileId,
	ruleId: "0195c49b-8f3b-7e18-8c45-c2f36ee8d339",
};

describe("adjacent governance API contracts", () => {
	it("requires immutable merge revisions, exact confirmations, and a fingerprinted review", () => {
		const command = {
			sourceUnitId: profileId,
			targetUnitId: secondProfileId,
			confirmationSourceUnitId: profileId,
			confirmationTargetUnitId: secondProfileId,
			expectedSourceUpdatedAt: "2026-08-11T00:00:00.000Z",
			expectedTargetUpdatedAt: "2026-08-11T00:00:00.000Z",
			idempotencyKey: "merge-command-1",
			rules: [rule],
		};
		expect(Check(CreateReviewedUnitMergeBody, command)).toBe(true);
		expect(
			Check(CreateReviewedUnitMergeBody, { ...command, expectedSourceUpdatedAt: undefined }),
		).toBe(false);
		expect(
			Check(ReviewUnitMergeBody, {
				decision: "approve",
				requestFingerprint: "a".repeat(64),
			}),
		).toBe(true);
		expect(
			Check(ReviewUnitMergeBody, {
				decision: "approve",
				requestFingerprint: "stale",
			}),
		).toBe(false);
	});

	it("keeps review-case prose in a Post-backed internal note", () => {
		expect(Check(UpdateContentReviewCaseBody, { internalNote })).toBe(true);
		expect(Check(UpdateContentReviewCaseBody, { reason: "copied rationale" })).toBe(false);
		expect(Check(UpdateContentReviewCaseBody, { safeSummary: "copied summary" })).toBe(false);
	});

	it("requires Rules for policy decisions and an exact restoration reference", () => {
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "invalidate_license",
				licenseGrantId: secondProfileId,
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "invalidate_license",
				rules: [rule],
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "approve",
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "approve",
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "restore_license",
				reversesActionId: secondProfileId,
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "restore_license",
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: profileId,
				kind: "remove",
				rules: [rule],
				reasonCode: "content_policy",
			}),
		).toBe(false);
	});

	it("replaces grants and restrictions for one Unit authorization subject", () => {
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: profileId, relation: "member" },
				grants: ["realm.tag-contexts.manage"],
				restrictions: [],
				scope: [],
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: profileId, relation: "access_manager" },
				grants: ["unit.access.manage"],
				restrictions: [],
				scope: [],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: profileId },
				grants: ["unit.read"],
				restrictions: [],
				scope: [],
			}),
		).toBe(false);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "profile", profileId },
				grants: ["unit.read"],
				restrictions: ["unit.update"],
				scope: [],
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "authenticated" },
				grants: ["unit.read"],
				restrictions: [],
				scope: [],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "profile", profileId },
				grants: [],
				restrictions: [],
				scope: [],
				reason: "copied rationale",
			}),
		).toBe(false);
	});

	it("keeps governance ownership transfer separate from access grants", () => {
		expect(
			Check(TransferUnitOwnershipBody, {
				expectedOwnerProfileId: profileId,
				targetProfileId: secondProfileId,
			}),
		).toBe(true);
		expect(
			Check(TransferUnitOwnershipBody, {
				expectedOwnerProfileId: profileId,
				targetProfileId: secondProfileId,
				owner: { kind: "system" },
			}),
		).toBe(false);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "profile", profileId },
				grants: ["unit.ownership.transfer"],
				restrictions: [],
				scope: [],
			}),
		).toBe(false);
	});

	it("requires an explicit platform ownership override confirmation", () => {
		expect(
			Check(OverrideUnitOwnershipBody, {
				expectedOwnerProfileId: null,
				targetProfileId: secondProfileId,
				confirmationUnitId: profileId,
				rules: [rule],
				note: "Recover an ownerless Unit.",
			}),
		).toBe(true);
		expect(
			Check(OverrideUnitOwnershipBody, {
				expectedOwnerProfileId: profileId,
				targetProfileId: secondProfileId,
				rules: [rule],
			}),
		).toBe(false);
	});

	it("keeps pending access invitations permission-based", () => {
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedProfileId: profileId,
				permissions: ["unit.update", "unit.status.update"],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(true);
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedProfileId: profileId,
				permissions: [],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(false);
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedProfileId: profileId,
				permissions: ["unit.ownership.transfer"],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(false);
	});

	it("removes copied rationale and public messages from enforcement commands", () => {
		expect(
			Check(CreateAccountEnforcementBody, {
				profileId,
				kind: "warning",
				rules: [rule],
				notes: [{ role: "public_notice", language: "en", content }],
			}),
		).toBe(true);
		expect(
			Check(CreateAccountEnforcementBody, {
				profileId,
				kind: "warning",
				reasonCode: "content_policy",
			}),
		).toBe(false);
		expect(Check(RevokeAccountEnforcementBody, {})).toBe(true);
		expect(Check(RevokeAccountEnforcementBody, { reasonCode: "appeal" })).toBe(false);
	});
});
