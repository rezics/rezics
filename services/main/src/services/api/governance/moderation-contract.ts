import type { CreateModerationActionBody } from "./schema";
import {
	ModerationActionIncompatible,
	ModerationActionNoEffect,
	ModerationTransitionInvalid,
} from "./errors";
import {
	ActiveReportCaseStateValues,
	type ModerationCaseStateValues,
	type ModerationTargetKindValues,
	type PlatformUnitModerationCommandValues,
	type RealmMemberStateValues,
	type RealmModerationCommandValues,
	type RealmUnitStatusValues,
	type UnitContentLicenseStatusValues,
} from "../../database/schema/contract-values";

export type ModerationActionCommand = CreateModerationActionBody["kind"];
export type ModerationTargetKind = (typeof ModerationTargetKindValues)[number];
export type RealmUnitStatus = (typeof RealmUnitStatusValues)[number];
export type RealmModerationCommand = (typeof RealmModerationCommandValues)[number];
export type RealmMemberState = (typeof RealmMemberStateValues)[number];
export type ModerationCaseState = (typeof ModerationCaseStateValues)[number];
export type UnitModerationStatus = "approved" | "pending" | "removed";
export type PlatformUnitModerationCommand = (typeof PlatformUnitModerationCommandValues)[number];
export type UnitContentLicenseStatus = (typeof UnitContentLicenseStatusValues)[number];

export function isContentLicenseModerationCommand(
	action: ModerationActionCommand,
): action is Extract<
	ModerationActionCommand,
	"invalidate_content_license" | "restore_content_license"
> {
	return action === "invalidate_content_license" || action === "restore_content_license";
}

export function isActiveReportCaseState(state: ModerationCaseState): boolean {
	return ActiveReportCaseStateValues.some((candidate) => candidate === state);
}

export function assertReportCaseDismissible(state: ModerationCaseState, reportCount: number): void {
	if (!isActiveReportCaseState(state) || reportCount < 1) throw new ModerationActionNoEffect();
}

const SharedAdministrativeActions = ["escalate", "reverse", "note"] as const;
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

const ActionsByTarget = {
	unit: [
		"approve",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		"invalidate_content_license",
		"restore_content_license",
		"dismiss",
		...SharedAdministrativeActions,
	],
	unit_field: ["approve", "remove", "restore", ...SharedAdministrativeActions],
	profile: SharedAdministrativeActions,
	realm_unit: [
		"approve",
		"hide",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		...SharedAdministrativeActions,
	],
	realm_member: [
		"mute_member",
		"remove_member",
		"ban_member",
		"restore_member",
		...SharedAdministrativeActions,
	],
} as const satisfies Record<ModerationTargetKind, readonly ModerationActionCommand[]>;

export function isModerationActionCompatible(
	targetKind: ModerationTargetKind,
	action: ModerationActionCommand,
): boolean {
	return ActionsByTarget[targetKind].some((candidate) => candidate === action);
}

export function assertModerationActionCompatible(
	targetKind: ModerationTargetKind,
	action: ModerationActionCommand,
): void {
	if (!isModerationActionCompatible(targetKind, action)) throw new ModerationActionIncompatible();
}

function resolveStateTransition<T extends string>(
	current: T,
	allowedFrom: readonly T[],
	next: T,
): T {
	if (current === next) throw new ModerationActionNoEffect();
	if (!allowedFrom.includes(current)) throw new ModerationTransitionInvalid();
	return next;
}

export function resolveRealmUnitStatus(
	current: RealmUnitStatus,
	action: Extract<ModerationActionCommand, "approve" | "hide" | "remove" | "restore">,
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
}

export function resolveUnitModerationStatus(
	current: UnitModerationStatus,
	action: Extract<ModerationActionCommand, "approve" | "remove" | "restore">,
): UnitModerationStatus {
	switch (action) {
		case "approve":
			return resolveStateTransition(current, ["pending"], "approved");
		case "remove":
			return resolveStateTransition(current, ["approved", "pending"], "removed");
		case "restore":
			return resolveStateTransition(current, ["removed"], "approved");
	}
}

export function resolveRealmMemberState(
	current: RealmMemberState,
	action: Extract<
		ModerationActionCommand,
		"mute_member" | "remove_member" | "ban_member" | "restore_member"
	>,
): RealmMemberState {
	switch (action) {
		case "mute_member":
			return resolveStateTransition(current, ["active"], "muted");
		case "remove_member":
			return resolveStateTransition(current, ["active", "pending", "muted"], "removed");
		case "ban_member":
			return resolveStateTransition(
				current,
				["active", "pending", "muted", "removed"],
				"banned",
			);
		case "restore_member":
			return resolveStateTransition(current, ["muted", "removed", "banned"], "active");
	}
}

export function resolvePostTargetingLockState(
	current: boolean,
	action: "lock_post_targeting" | "unlock_post_targeting",
): boolean {
	const next = action === "lock_post_targeting";
	if (current === next) throw new ModerationActionNoEffect();
	return next;
}

export function resolveUnitContentLicenseStatus(
	current: UnitContentLicenseStatus,
	action: Extract<
		ModerationActionCommand,
		"invalidate_content_license" | "restore_content_license"
	>,
): UnitContentLicenseStatus {
	switch (action) {
		case "invalidate_content_license":
			return resolveStateTransition(current, ["active"], "invalidated");
		case "restore_content_license":
			return resolveStateTransition(current, ["invalidated"], "active");
	}
}

export function resolveModerationCaseState(
	current: ModerationCaseState,
	action: ModerationActionCommand,
): ModerationCaseState {
	if (action === "note") return current;
	if (action === "escalate") {
		if (current === "escalated") throw new ModerationActionNoEffect();
		return "escalated";
	}
	if (action === "dismiss") return "rejected";
	return "actioned";
}
