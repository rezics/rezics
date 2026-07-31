import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateAccountEnforcementBody,
	CreateModerationActionBody,
	CreateUnitAccessInvitationBody,
	OverrideUnitOwnershipBody,
	ReplaceUnitSubjectAccessBody,
	RevokeAccountEnforcementBody,
	TransferUnitOwnershipBody,
	UpdateModerationCaseBody,
} from "./schema";

const profileId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const secondProfileId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d338";
const content = createPortableTextDocument([], "0123456789ab");
const internalNote = { language: "en", content };

describe("adjacent governance API contracts", () => {
	it("keeps moderation case prose in a Post-backed internal note", () => {
		expect(Check(UpdateModerationCaseBody, { internalNote })).toBe(true);
		expect(Check(UpdateModerationCaseBody, { reason: "copied rationale" })).toBe(false);
		expect(Check(UpdateModerationCaseBody, { safeSummary: "copied summary" })).toBe(false);
	});

	it("requires restoration to reference the exact license invalidation action", () => {
		expect(
			Check(CreateModerationActionBody, {
				caseId: profileId,
				kind: "invalidate_content_license",
				reasonCode: "copyright",
			}),
		).toBe(true);
		expect(
			Check(CreateModerationActionBody, {
				caseId: profileId,
				kind: "restore_content_license",
				reasonCode: "appeal",
				reversesActionId: secondProfileId,
			}),
		).toBe(true);
		expect(
			Check(CreateModerationActionBody, {
				caseId: profileId,
				kind: "restore_content_license",
				reasonCode: "appeal",
			}),
		).toBe(false);
	});

	it("replaces grants and restrictions for one Unit authorization subject", () => {
		expect(
			Check(ReplaceUnitSubjectAccessBody, {
				subject: { kind: "profile", profileId },
				grants: ["unit.read"],
				restrictions: ["unit.update"],
				scope: [],
				reasonCode: "account_security",
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
				reasonCode: "administrative",
				note: "Recover an ownerless Unit.",
			}),
		).toBe(true);
		expect(
			Check(OverrideUnitOwnershipBody, {
				expectedOwnerProfileId: profileId,
				targetProfileId: secondProfileId,
				reasonCode: "administrative",
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
				reasonCode: "content_policy",
				notes: [{ role: "public_notice", language: "en", content }],
			}),
		).toBe(true);
		expect(
			Check(CreateAccountEnforcementBody, {
				profileId,
				kind: "warning",
				reasonCode: "content_policy",
				publicMessage: "copied public message",
			}),
		).toBe(false);
		expect(Check(RevokeAccountEnforcementBody, { reasonCode: "appeal" })).toBe(true);
	});
});
