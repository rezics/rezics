import { describe, expect, it } from "vitest";
import { createPortableTextDocument } from "@rezics/block";

import {
	assertModerationActionCompatible,
	isModerationActionCompatible,
	resolvePostTargetingLockState,
	resolveModerationCaseState,
	resolveRealmMemberState,
	resolveRealmUnitStatus,
	resolveUnitModerationStatus,
} from "./moderation-contract";
import { fingerprintModerationAction } from "./moderation-service";

describe("moderation action contracts", () => {
	it("rejects commands that do not belong to the case target", () => {
		expect(isModerationActionCompatible("realm_unit", "hide")).toBe(true);
		expect(isModerationActionCompatible("unit", "hide")).toBe(false);
		expect(isModerationActionCompatible("realm_member", "approve")).toBe(false);
		expect(() => assertModerationActionCompatible("feedback", "remove")).toThrow(
			"not valid for this target",
		);
	});

	it("derives strict Realm Unit transitions", () => {
		expect(resolveRealmUnitStatus("pending", "approve")).toBe("visible");
		expect(resolveRealmUnitStatus("visible", "hide")).toBe("hidden");
		expect(resolveRealmUnitStatus("hidden", "restore")).toBe("visible");
		expect(resolveRealmUnitStatus("visible", "remove")).toBe("removed");
		expect(() => resolveRealmUnitStatus("removed", "approve")).toThrow(
			"cannot make that state transition",
		);
		expect(() => resolveRealmUnitStatus("visible", "approve")).toThrow(
			"would not change the target",
		);
	});

	it("derives Unit and Realm member transitions", () => {
		expect(resolveUnitModerationStatus("pending", "approve")).toBe("approved");
		expect(resolveUnitModerationStatus("removed", "restore")).toBe("approved");
		expect(resolveRealmMemberState("active", "mute_member")).toBe("muted");
		expect(resolveRealmMemberState("removed", "ban_member")).toBe("banned");
		expect(resolveRealmMemberState("banned", "restore_member")).toBe("active");
	});

	it("rejects lock no-ops and keeps note-only cases open", () => {
		expect(resolvePostTargetingLockState(false, "lock_post_targeting")).toBe(true);
		expect(resolvePostTargetingLockState(true, "unlock_post_targeting")).toBe(false);
		expect(() => resolvePostTargetingLockState(true, "lock_post_targeting")).toThrow(
			"would not change the target",
		);
		expect(resolveModerationCaseState("reviewing", "note")).toBe("reviewing");
		expect(resolveModerationCaseState("reviewing", "escalate")).toBe("escalated");
		expect(resolveModerationCaseState("reviewing", "remove")).toBe("actioned");
	});

	it("fingerprints request meaning independently from the idempotency key", () => {
		const request = {
			caseId: "0195c49b-c3a1-7f07-8000-000000000001",
			kind: "note" as const,
			reasonCode: "administrative" as const,
			notes: [
				{
					role: "internal_note" as const,
					language: "zh" as const,
					content: createPortableTextDocument([], "0123456789ab"),
				},
			],
		};
		expect(fingerprintModerationAction({ ...request, idempotencyKey: "first-attempt" })).toBe(
			fingerprintModerationAction({ ...request, idempotencyKey: "retry" }),
		);
		expect(
			fingerprintModerationAction({
				...request,
				reasonCode: "realm_rules",
				idempotencyKey: "retry",
			}),
		).not.toBe(fingerprintModerationAction({ ...request, idempotencyKey: "retry" }));
	});
});
