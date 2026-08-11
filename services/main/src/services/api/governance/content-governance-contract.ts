import type { CreateContentGovernanceActionBody } from "./schema";
import {
	ContentGovernanceActionIncompatible,
	ContentGovernanceActionNoEffect,
	ContentGovernanceTransitionInvalid,
} from "./errors";
import {
	ActiveContentReviewCaseStateValues,
	ContentGovernanceRuleBackedActionKindValues,
	type ContentReviewAuthorityValues,
	type ContentReviewCaseStateValues,
	type PlatformUnitModerationCommandValues,
	type RealmModerationCommandValues,
	type RealmUnitStatusValues,
	type UnitContentLicenseStatusValues,
} from "../../database/schema/contract-values";

export type ContentGovernanceActionCommand = CreateContentGovernanceActionBody["kind"];
export type ContentReviewAuthority = (typeof ContentReviewAuthorityValues)[number];
export type RealmUnitStatus = (typeof RealmUnitStatusValues)[number];
export type RealmModerationCommand = (typeof RealmModerationCommandValues)[number];
export type ContentReviewCaseState = (typeof ContentReviewCaseStateValues)[number];
export type UnitModerationStatus = "approved" | "pending" | "removed";
export type PlatformUnitModerationCommand = (typeof PlatformUnitModerationCommandValues)[number];
export type UnitContentLicenseStatus = (typeof UnitContentLicenseStatusValues)[number];

export function isContentLicenseModerationCommand(
	action: ContentGovernanceActionCommand,
): action is Extract<
	ContentGovernanceActionCommand,
	"invalidate_content_license" | "restore_content_license"
> {
	return action === "invalidate_content_license" || action === "restore_content_license";
}

export function contentGovernanceActionRequiresRules(
	action: ContentGovernanceActionCommand,
): boolean {
	return ContentGovernanceRuleBackedActionKindValues.some((candidate) => candidate === action);
}

export function isActiveContentReviewCaseState(state: ContentReviewCaseState): boolean {
	return ActiveContentReviewCaseStateValues.some((candidate) => candidate === state);
}

export function assertReportCaseDismissible(
	state: ContentReviewCaseState,
	reportCount: number,
): void {
	if (!isActiveContentReviewCaseState(state) || reportCount < 1)
		throw new ContentGovernanceActionNoEffect();
}

const RealmUnitStateCommands = {
	pending: ["approve", "remove"],
	visible: ["hide", "remove"],
	hidden: ["restore", "remove"],
	removed: ["restore"],
} as const satisfies Record<RealmUnitStatus, readonly RealmModerationCommand[]>;

export function getRealmUnitModerationCommands(
	status: RealmUnitStatus,
	postTargetingLocked: boolean,
	hasOpenReports = false,
): readonly RealmModerationCommand[] {
	const reportCommands: readonly RealmModerationCommand[] = hasOpenReports ? ["dismiss"] : [];
	return [
		...RealmUnitStateCommands[status],
		postTargetingLocked ? "unlock_post_targeting" : "lock_post_targeting",
		...reportCommands,
		"note",
	];
}

const PlatformUnitStateCommands = {
	approved: ["remove"],
	pending: ["approve", "remove"],
	removed: ["restore"],
} as const satisfies Record<UnitModerationStatus, readonly PlatformUnitModerationCommand[]>;

export function getPlatformUnitModerationCommands(
	status: UnitModerationStatus,
	postTargetingLocked: boolean,
	contentLicenseStatus: UnitContentLicenseStatus | null = null,
	hasOpenReports = false,
): readonly PlatformUnitModerationCommand[] {
	const reportCommands: readonly PlatformUnitModerationCommand[] = hasOpenReports
		? ["dismiss"]
		: [];
	const contentLicenseCommands: readonly PlatformUnitModerationCommand[] =
		contentLicenseStatus === "active"
			? ["invalidate_content_license"]
			: contentLicenseStatus === "invalidated"
				? ["restore_content_license"]
				: [];
	return [
		...PlatformUnitStateCommands[status],
		postTargetingLocked ? "unlock_post_targeting" : "lock_post_targeting",
		...contentLicenseCommands,
		...reportCommands,
		"note",
	];
}

const ActionsByAuthority = {
	platform: [
		"approve",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		"invalidate_content_license",
		"restore_content_license",
		"reverse",
	],
	realm: [
		"approve",
		"hide",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		"reverse",
	],
} as const satisfies Record<ContentReviewAuthority, readonly ContentGovernanceActionCommand[]>;

export function assertContentGovernanceActionCompatible(
	authority: ContentReviewAuthority,
	action: ContentGovernanceActionCommand,
): void {
	if (!ActionsByAuthority[authority].some((candidate) => candidate === action))
		throw new ContentGovernanceActionIncompatible();
}

function resolveStateTransition<T extends string>(
	current: T,
	allowedFrom: readonly T[],
	next: T,
): T {
	if (current === next) throw new ContentGovernanceActionNoEffect();
	if (!allowedFrom.includes(current)) throw new ContentGovernanceTransitionInvalid();
	return next;
}

export function resolveRealmUnitStatus(
	current: RealmUnitStatus,
	action: Extract<ContentGovernanceActionCommand, "approve" | "hide" | "remove" | "restore">,
): RealmUnitStatus {
	switch (action) {
		case "approve":
			return resolveStateTransition(current, ["pending"], "visible");
		case "hide":
			return resolveStateTransition(current, ["visible"], "hidden");
		case "remove":
			return resolveStateTransition(current, ["pending", "visible", "hidden"], "removed");
		case "restore":
			return resolveStateTransition(current, ["hidden", "removed"], "visible");
	}
	throw new ContentGovernanceActionIncompatible();
}

export function resolveUnitModerationStatus(
	current: UnitModerationStatus,
	action: Extract<ContentGovernanceActionCommand, "approve" | "remove" | "restore">,
): UnitModerationStatus {
	switch (action) {
		case "approve":
			return resolveStateTransition(current, ["pending"], "approved");
		case "remove":
			return resolveStateTransition(current, ["approved", "pending"], "removed");
		case "restore":
			return resolveStateTransition(current, ["removed"], "approved");
	}
	throw new ContentGovernanceActionIncompatible();
}

export function resolvePostTargetingLockState(
	current: boolean,
	action: "lock_post_targeting" | "unlock_post_targeting",
): boolean {
	const next = action === "lock_post_targeting";
	if (current === next) throw new ContentGovernanceActionNoEffect();
	return next;
}

export function resolveUnitContentLicenseStatus(
	current: UnitContentLicenseStatus,
	action: Extract<
		ContentGovernanceActionCommand,
		"invalidate_content_license" | "restore_content_license"
	>,
): UnitContentLicenseStatus {
	switch (action) {
		case "invalidate_content_license":
			return resolveStateTransition(current, ["active"], "invalidated");
		case "restore_content_license":
			return resolveStateTransition(current, ["invalidated"], "active");
	}
	throw new ContentGovernanceActionIncompatible();
}
