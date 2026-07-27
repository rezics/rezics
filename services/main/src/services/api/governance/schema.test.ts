import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateAccountEnforcementBody,
	CreateUnitAccessInvitationBody,
	ReplaceUnitSubjectAccessBody,
	ResolveFeedbackBody,
	RevokeAccountEnforcementBody,
	TransferUnitOwnershipBody,
	UpdateModerationCaseBody,
} from "./schema";

const profileId = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";
const content = createPortableTextDocument([], "0123456789ab");
const internalNote = { language: "en", content };

describe("adjacent governance API contracts", () => {
	it("keeps moderation case prose in a Post-backed internal note", () => {
		expect(Check(UpdateModerationCaseBody, { internalNote })).toBe(true);
		expect(Check(UpdateModerationCaseBody, { reason: "copied rationale" })).toBe(false);
		expect(Check(UpdateModerationCaseBody, { safeSummary: "copied summary" })).toBe(false);
	});

	it("uses a resolution code plus an optional public-notice Post", () => {
		expect(
			Check(ResolveFeedbackBody, {
				resolutionCode: "content_policy",
				publicNotice: { language: "en", content },
			}),
		).toBe(true);
		expect(Check(ResolveFeedbackBody, { resolution: "copied resolution" })).toBe(false);
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
				owner: { kind: "profile", profileId },
			}),
		).toBe(true);
		expect(Check(TransferUnitOwnershipBody, { owner: { kind: "system" } })).toBe(false);
	});

	it("keeps pending access invitations permission-based", () => {
		expect(
			Check(CreateUnitAccessInvitationBody, {
				invitedProfileId: profileId,
				permissions: ["unit.update", "unit.publish"],
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
