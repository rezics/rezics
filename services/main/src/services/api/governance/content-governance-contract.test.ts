import { createPortableTextDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import {
	assertContentGovernanceActionCompatible,
	assertReportCaseDismissible,
	contentGovernanceActionRequiresRules,
	getPlatformUnitModerationCommands,
	getRealmUnitModerationCommands,
	isContentLicenseModerationCommand,
	resolvePostTargetingLockState,
	resolveRealmUnitStatus,
	resolveUnitContentLicenseStatus,
	resolveUnitModerationStatus,
} from "./content-governance-contract";
import { fingerprintContentGovernanceAction } from "./content-governance-service";

describe("content governance contracts", () => {
	it("limits actions to the review authority", () => {
		expect(() => assertContentGovernanceActionCompatible("realm", "hide")).not.toThrow();
		expect(() => assertContentGovernanceActionCompatible("platform", "hide")).toThrow(
			"not valid for this target",
		);
		expect(() =>
			assertContentGovernanceActionCompatible("platform", "invalidate_content_license"),
		).not.toThrow();
		expect(() =>
			assertContentGovernanceActionCompatible("realm", "invalidate_content_license"),
		).toThrow("not valid for this target");
		expect(isContentLicenseModerationCommand("restore_content_license")).toBe(true);
		expect(isContentLicenseModerationCommand("restore")).toBe(false);
		expect(contentGovernanceActionRequiresRules("remove")).toBe(true);
		expect(contentGovernanceActionRequiresRules("restore")).toBe(true);
		expect(contentGovernanceActionRequiresRules("restore_content_license")).toBe(false);
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

	it("presents only commands valid for the current Realm Unit snapshot", () => {
		expect(getRealmUnitModerationCommands("pending", false)).toEqual([
			"approve",
			"remove",
			"lock_post_targeting",
			"note",
		]);
		expect(getRealmUnitModerationCommands("visible", true)).toEqual([
			"hide",
			"remove",
			"unlock_post_targeting",
			"note",
		]);
		expect(getRealmUnitModerationCommands("visible", false, true)).toEqual([
			"hide",
			"remove",
			"lock_post_targeting",
			"dismiss",
			"note",
		]);
	});

	it("presents only commands valid for the current platform Unit snapshot", () => {
		expect(getPlatformUnitModerationCommands("pending", false)).toEqual([
			"approve",
			"remove",
			"lock_post_targeting",
			"note",
		]);
		expect(getPlatformUnitModerationCommands("approved", true, null, true)).toEqual([
			"remove",
			"unlock_post_targeting",
			"dismiss",
			"note",
		]);
		expect(getPlatformUnitModerationCommands("approved", false, "active")).toEqual([
			"remove",
			"lock_post_targeting",
			"invalidate_content_license",
			"note",
		]);
	});

	it("derives platform and license transitions", () => {
		expect(resolveUnitModerationStatus("pending", "approve")).toBe("approved");
		expect(resolveUnitModerationStatus("removed", "restore")).toBe("approved");
		expect(resolveUnitContentLicenseStatus("active", "invalidate_content_license")).toBe(
			"invalidated",
		);
		expect(resolveUnitContentLicenseStatus("invalidated", "restore_content_license")).toBe(
			"active",
		);
	});

	it("rejects lock no-ops", () => {
		expect(resolvePostTargetingLockState(false, "lock_post_targeting")).toBe(true);
		expect(resolvePostTargetingLockState(true, "unlock_post_targeting")).toBe(false);
		expect(() => resolvePostTargetingLockState(true, "lock_post_targeting")).toThrow(
			"would not change the target",
		);
	});

	it("only dismisses active cases backed by at least one report", () => {
		expect(() => assertReportCaseDismissible("reviewing", 1)).not.toThrow();
		expect(() => assertReportCaseDismissible("reviewing", 0)).toThrow(
			"would not change the target",
		);
		expect(() => assertReportCaseDismissible("rejected", 1)).toThrow("would not change the target");
	});

	it("fingerprints selected rules but not the retry key", () => {
		const request = {
			caseId: "0195c49b-c3a1-7f07-8000-000000000001",
			kind: "remove" as const,
			rules: [
				{
					sourceRealmId: "0195c49b-c3a1-7f07-8000-000000000002",
					revisionId: "0195c49b-c3a1-7f07-8000-000000000003",
					ruleId: "0195c49b-c3a1-7f07-8000-000000000004",
				},
			],
			notes: [
				{
					role: "internal_note" as const,
					language: "zh" as const,
					content: createPortableTextDocument([], "0123456789ab"),
				},
			],
		};
		expect(
			fingerprintContentGovernanceAction({ ...request, idempotencyKey: "first-attempt" }),
		).toBe(fingerprintContentGovernanceAction({ ...request, idempotencyKey: "retry" }));
		expect(
			fingerprintContentGovernanceAction({
				...request,
				rules: [
					{
						sourceRealmId: "0195c49b-c3a1-7f07-8000-000000000002",
						revisionId: "0195c49b-c3a1-7f07-8000-000000000003",
						ruleId: "0195c49b-c3a1-7f07-8000-000000000005",
					},
				],
				idempotencyKey: "retry",
			}),
		).not.toBe(fingerprintContentGovernanceAction({ ...request, idempotencyKey: "retry" }));
	});
});
