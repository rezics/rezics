import { createPortableTextDocument } from "@rezics/block";
import { MergeCreateSchema, MergeReviewSchema } from "../../units/merge/contracts";
import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateAccountEnforcementBody,
	CreateContentGovernanceActionBody,
	CreateUnitAccessInvitationBody,
	OverrideUnitOwnershipBody,
	ReplaceUnitSubjectAccessBody,
	RevokeAccountEnforcementBody,
	TransferUnitOwnershipBody,
	UpdateContentReviewCaseBody,
} from "./schema";

const entityId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const secondEntityId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d338";
const authUserId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const content = createPortableTextDocument([], "0123456789ab");
const internalNote = { language: "en", content };
const rule = {
	sourceRealmId: entityId,
	revisionId: secondEntityId,
	ruleId: "0195c49b-8f3b-7e18-8c45-c2f36ee8d339",
};

describe("adjacent governance API contracts", () => {
	it("pins merge revisions and fingerprint with exact confirmation identities", () => {
		const command = {
			sourceUnitId: entityId,
			targetUnitId: secondEntityId,
			confirmationSourceUnitId: entityId,
			confirmationTargetUnitId: secondEntityId,
			expectedSourceRevision: 1,
			expectedTargetRevision: 2,
			requestFingerprint: "a".repeat(64),
			idempotencyKey: "merge-1",
			rules: [rule],
		};
		expect(MergeCreateSchema.safeParse(command).success).toBe(true);
		expect(
			MergeCreateSchema.safeParse({ ...command, expectedSourceRevision: undefined }).success,
		).toBe(false);
		expect(
			MergeReviewSchema.safeParse({ decision: "approve", requestFingerprint: "a".repeat(64) })
				.success,
		).toBe(true);
		expect(
			MergeReviewSchema.safeParse({ decision: "approve", requestFingerprint: "stale" }).success,
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
				caseId: entityId,
				kind: "invalidate_license",
				licenseGrantId: secondEntityId,
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "invalidate_license",
				rules: [rule],
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "approve",
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "approve",
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "restore_license",
				reversesActionId: secondEntityId,
			}),
		).toBe(true);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "restore_license",
			}),
		).toBe(false);
		expect(
			Check(CreateContentGovernanceActionBody, {
				caseId: entityId,
				kind: "remove",
				rules: [rule],
				reasonCode: "content_policy",
			}),
		).toBe(false);
	});

	it("replaces grants and restrictions for one Unit authorization subject", () => {
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: entityId, relation: "member" },
				grants: ["realm.tag-contexts.manage"],
				restrictions: [],
				scope: [],
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: entityId, relation: "access_manager" },
				grants: ["unit.access.manage"],
				restrictions: [],
				scope: [],
			}),
		).toBe(true);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "realm", realmId: entityId },
				grants: ["unit.read"],
				restrictions: [],
				scope: [],
			}),
		).toBe(false);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "auth", authUserId },
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
				subject: { kind: "auth", authUserId },
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
				expectedOwnerEntityId: entityId,
				targetEntityId: secondEntityId,
			}),
		).toBe(true);
		expect(
			Check(TransferUnitOwnershipBody, {
				expectedOwnerEntityId: entityId,
				targetEntityId: secondEntityId,
				owner: { kind: "system" },
			}),
		).toBe(false);
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "auth", authUserId },
				grants: ["unit.ownership.transfer"],
				restrictions: [],
				scope: [],
			}),
		).toBe(false);
	});

	it("requires an explicit platform ownership override confirmation", () => {
		expect(
			Check(OverrideUnitOwnershipBody, {
				expectedOwnerEntityId: null,
				targetEntityId: secondEntityId,
				confirmationUnitId: entityId,
				rules: [rule],
				note: "Recover an ownerless Unit.",
			}),
		).toBe(true);
		expect(
			Check(OverrideUnitOwnershipBody, {
				expectedOwnerEntityId: entityId,
				targetEntityId: secondEntityId,
				rules: [rule],
			}),
		).toBe(false);
	});

	it("keeps pending access invitations permission-based", () => {
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedAuthUserId: authUserId,
				permissions: ["unit.update", "unit.status.update"],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(true);
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedAuthUserId: authUserId,
				permissions: [],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(false);
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedAuthUserId: authUserId,
				permissions: ["unit.ownership.transfer"],
				scope: [],
				invitationExpiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(false);
	});

	it("removes copied rationale and public messages from enforcement commands", () => {
		expect(
			Check(CreateAccountEnforcementBody, {
				authUserId,
				kind: "warning",
				rules: [rule],
				notes: [{ role: "public_notice", language: "en", content }],
			}),
		).toBe(true);
		expect(
			Check(CreateAccountEnforcementBody, {
				authUserId,
				kind: "warning",
				reasonCode: "content_policy",
			}),
		).toBe(false);
		expect(Check(RevokeAccountEnforcementBody, {})).toBe(true);
		expect(Check(RevokeAccountEnforcementBody, { reasonCode: "appeal" })).toBe(false);
	});
});
