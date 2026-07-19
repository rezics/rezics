import type { CreateModerationActionBody } from "./schema";
import {
	ModerationActionIncompatible,
	ModerationActionNoEffect,
	ModerationTransitionInvalid,
} from "./errors";
import type {
	ModerationCaseStateValues,
	ModerationTargetKindValues,
	RealmMemberStateValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";

export type ModerationActionCommand = CreateModerationActionBody["kind"];
export type ModerationTargetKind = (typeof ModerationTargetKindValues)[number];
export type RealmUnitStatus = (typeof RealmUnitStatusValues)[number];
export type RealmMemberState = (typeof RealmMemberStateValues)[number];
export type ModerationCaseState = (typeof ModerationCaseStateValues)[number];
export type UnitModerationStatus = "approved" | "pending" | "removed";

const SharedAdministrativeActions = ["escalate", "reverse", "note"] as const;
const ActionsByTarget = {
	unit: [
		"approve",
		"remove",
		"restore",
		"lock",
		"unlock",
		"protect",
		"unprotect",
		...SharedAdministrativeActions,
	],
	unit_field: [
		"approve",
		"remove",
		"restore",
		"lock",
		"unlock",
		"protect",
		"unprotect",
		...SharedAdministrativeActions,
	],
	profile: SharedAdministrativeActions,
	realm_unit: [
		"approve",
		"hide",
		"remove",
		"restore",
		"lock",
		"unlock",
		...SharedAdministrativeActions,
	],
	realm_member: [
		"mute_member",
		"remove_member",
		"ban_member",
		"restore_member",
		...SharedAdministrativeActions,
	],
	feedback: SharedAdministrativeActions,
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

export function resolveLockState(current: boolean, action: "lock" | "unlock"): boolean {
	const next = action === "lock";
	if (current === next) throw new ModerationActionNoEffect();
	return next;
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
	return "actioned";
}
