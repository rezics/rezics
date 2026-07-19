import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	ClaimUnitOwnershipBody,
	CreateAccountEnforcementBody,
	CreateUnitAccessRestrictionBody,
	CreateUnitAccessBindingBody,
	CreateUnitProtectionBody,
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

	it("uses codes and optional internal notes for Unit access decisions", () => {
		expect(
			Check(CreateUnitAccessRestrictionBody, {
				subject: { kind: "profile", profileId },
				permission: "unit.update",
				scope: [],
				reasonCode: "account_security",
				internalNote,
			}),
		).toBe(true);
		expect(
			Check(CreateUnitProtectionBody, {
				scope: [],
				mode: "frozen",
				reasonCode: "administrative",
				internalNote,
			}),
		).toBe(true);
		expect(
			Check(CreateUnitProtectionBody, {
				scope: [],
				mode: "frozen",
				reason: "copied rationale",
			}),
		).toBe(false);
	});

	it("keeps governance ownership transfer separate from delegable access", () => {
		expect(
			Check(CreateUnitAccessBindingBody, {
				subject: { kind: "profile", profileId },
				role: "owner",
				scope: [],
			}),
		).toBe(false);
		expect(
			Check(TransferUnitOwnershipBody, {
				owner: { kind: "profile", profileId },
			}),
		).toBe(true);
		expect(Check(TransferUnitOwnershipBody, { owner: { kind: "system" } })).toBe(false);
		expect(Check(ClaimUnitOwnershipBody, {})).toBe(true);
		expect(Check(ClaimUnitOwnershipBody, { owner: { kind: "profile", profileId } })).toBe(
			false,
		);
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
