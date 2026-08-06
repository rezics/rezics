import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import type { DatabaseTransaction } from "../../database";
import {
	moderationAction,
	moderationCase,
	platformUnitReport,
	profile as profileTable,
	realmMember,
	realmUnit,
	realmUnitReport,
	realmUnitStatusEvent,
	unit,
	unitContentLicense,
	unitOwnership,
} from "../../database/schema";
import { createGovernanceNotePost, listGovernanceNotes } from "../../governance/note-service";
import { createNotification } from "../../notifications/service";
import {
	ModerationActionIncompatible,
	ModerationActionNoEffect,
	ModerationIdempotencyConflict,
	ModerationNoteRoleDuplicate,
	ModerationRealmMissing,
	ModerationReversalUnavailable,
	ModerationReversedActionInvalid,
	ModerationTargetNotFound,
	ModerationTransitionInvalid,
} from "./errors";
import {
	assertReportCaseDismissible,
	assertModerationActionCompatible,
	isActiveReportCaseState,
	resolvePostTargetingLockState,
	resolveModerationCaseState,
	resolveRealmMemberState,
	resolveRealmUnitStatus,
	resolveUnitContentLicenseStatus,
	resolveUnitModerationStatus,
	type RealmMemberState,
	type RealmUnitStatus,
	type UnitContentLicenseStatus,
	type UnitModerationStatus,
} from "./moderation-contract";
import type { CreateModerationActionBody } from "./schema";

export const moderationActionSelection = {
	id: moderationAction.id,
	caseId: moderationAction.caseId,
	actorProfileId: moderationAction.actorProfileId,
	kind: moderationAction.kind,
	previousState: moderationAction.previousState,
	resultingState: moderationAction.resultingState,
	previousPostTargetingLocked: moderationAction.previousPostTargetingLocked,
	contentLicenseId: moderationAction.contentLicenseId,
	previousContentLicenseStatus: moderationAction.previousContentLicenseStatus,
	resultingContentLicenseStatus: moderationAction.resultingContentLicenseStatus,
	resultingStatus: moderationAction.resultingStatus,
	resultingPostTargetingLocked: moderationAction.resultingPostTargetingLocked,
	reasonCode: moderationAction.reasonCode,
	reversesActionId: moderationAction.reversesActionId,
	createdAt: moderationAction.createdAt,
};

export type ModerationCaseRecord = typeof moderationCase.$inferSelect;

type ModerationTargetContext = {
	recipientProfileIds: readonly string[];
	subjectUnitId: string | undefined;
};

function presentProfileIds(rows: readonly { profileId: string | null }[]): string[] {
	return [...new Set(rows.flatMap((row) => (row.profileId ? [row.profileId] : [])))];
}

type StateActionPlan =
	| {
			type: "unit_state";
			previousState: UnitModerationStatus;
			resultingState: UnitModerationStatus;
	  }
	| {
			type: "realm_unit_state";
			previousState: RealmUnitStatus;
			resultingState: RealmUnitStatus;
	  }
	| {
			type: "realm_member_state";
			previousState: RealmMemberState;
			resultingState: RealmMemberState;
	  };

type LockActionPlan = {
	type: "unit_post_targeting_lock" | "realm_unit_post_targeting_lock";
	previousPostTargetingLocked: boolean;
	resultingPostTargetingLocked: boolean;
};

type ContentLicenseActionPlan = {
	type: "unit_content_license_state";
	contentLicenseId: string;
	previousContentLicenseStatus: UnitContentLicenseStatus;
	resultingContentLicenseStatus: UnitContentLicenseStatus;
};

type ModerationActionPlan =
	| StateActionPlan
	| LockActionPlan
	| ContentLicenseActionPlan
	| { type: "case_only" };

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.filter((entry) => entry[1] !== undefined)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, item]) => [key, canonicalize(item)]),
		);
	return value;
}

function isUnitModerationStatus(value: string): value is UnitModerationStatus {
	return value === "approved" || value === "pending" || value === "removed";
}

function isRealmUnitStatus(value: string): value is RealmUnitStatus {
	return value === "pending" || value === "visible" || value === "hidden" || value === "removed";
}

function isRealmMemberState(value: string): value is RealmMemberState {
	return (
		value === "active" ||
		value === "pending" ||
		value === "muted" ||
		value === "removed" ||
		value === "banned"
	);
}

export function fingerprintModerationAction(body: CreateModerationActionBody): string {
	const { idempotencyKey: _idempotencyKey, ...request } = body;
	return createHash("sha256")
		.update(JSON.stringify(canonicalize(request)))
		.digest("hex");
}

export async function loadModerationCaseForAction(
	tx: DatabaseTransaction,
	caseId: string,
): Promise<ModerationCaseRecord | undefined> {
	const [row] = await tx
		.select()
		.from(moderationCase)
		.where(eq(moderationCase.id, caseId))
		.for("update")
		.limit(1);
	return row;
}

async function getModerationTargetContext(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
): Promise<ModerationTargetContext> {
	if (row.targetKind === "unit" || row.targetKind === "unit_field") {
		const [target] = await tx
			.select({ id: unit.id })
			.from(unit)
			.where(eq(unit.id, row.targetId))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		const owners = await tx
			.select({ profileId: unitOwnership.profileId })
			.from(unitOwnership)
			.where(and(eq(unitOwnership.unitId, target.id), isNull(unitOwnership.revokedAt)));
		return { recipientProfileIds: presentProfileIds(owners), subjectUnitId: target.id };
	}
	if (row.targetKind === "profile") {
		const [target] = await tx
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(eq(profileTable.id, row.targetId))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		return { recipientProfileIds: [target.id], subjectUnitId: target.id };
	}
	if (row.targetKind === "realm_unit") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [target] = await tx
			.select({ unitId: realmUnit.unitId })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		const owners = await tx
			.select({ profileId: unitOwnership.profileId })
			.from(unitOwnership)
			.where(and(eq(unitOwnership.unitId, target.unitId), isNull(unitOwnership.revokedAt)));
		return {
			recipientProfileIds: presentProfileIds(owners),
			subjectUnitId: target.unitId,
		};
	}
	if (row.targetKind === "realm_member") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [target] = await tx
			.select({ profileId: realmMember.profileId })
			.from(realmMember)
			.where(
				and(eq(realmMember.realmId, row.realmId), eq(realmMember.profileId, row.targetId)),
			)
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		return { recipientProfileIds: [target.profileId], subjectUnitId: row.realmId };
	}
	throw new ModerationTargetNotFound();
}

async function loadUnitStatePlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	action: "approve" | "remove" | "restore",
): Promise<StateActionPlan> {
	const [current] = await tx
		.select({ status: unit.moderationStatus })
		.from(unit)
		.where(eq(unit.id, row.targetId))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationTargetNotFound();
	return {
		type: "unit_state",
		previousState: current.status,
		resultingState: resolveUnitModerationStatus(current.status, action),
	};
}

async function loadRealmUnitStatePlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	action: "approve" | "hide" | "remove" | "restore",
): Promise<StateActionPlan> {
	if (!row.realmId) throw new ModerationRealmMissing();
	const [current] = await tx
		.select({ status: realmUnit.status })
		.from(realmUnit)
		.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationTargetNotFound();
	return {
		type: "realm_unit_state",
		previousState: current.status,
		resultingState: resolveRealmUnitStatus(current.status, action),
	};
}

async function loadMemberStatePlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	action: "mute_member" | "remove_member" | "ban_member" | "restore_member",
): Promise<StateActionPlan> {
	if (!row.realmId) throw new ModerationRealmMissing();
	const [current] = await tx
		.select({ state: realmMember.state })
		.from(realmMember)
		.where(and(eq(realmMember.realmId, row.realmId), eq(realmMember.profileId, row.targetId)))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationTargetNotFound();
	return {
		type: "realm_member_state",
		previousState: current.state,
		resultingState: resolveRealmMemberState(current.state, action),
	};
}

async function loadPostTargetingLockPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	action: "lock_post_targeting" | "unlock_post_targeting",
): Promise<LockActionPlan> {
	if (row.targetKind === "realm_unit") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [targetUnit] = await tx
			.select({ id: unit.id })
			.from(unit)
			.where(eq(unit.id, row.targetId))
			.for("share")
			.limit(1);
		if (!targetUnit) throw new ModerationTargetNotFound();
		const [current] = await tx
			.select({ postTargetingLocked: realmUnit.postTargetingLocked })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
			.for("update")
			.limit(1);
		if (!current) throw new ModerationTargetNotFound();
		return {
			type: "realm_unit_post_targeting_lock",
			previousPostTargetingLocked: current.postTargetingLocked,
			resultingPostTargetingLocked: resolvePostTargetingLockState(
				current.postTargetingLocked,
				action,
			),
		};
	}
	if (row.targetKind !== "unit") throw new ModerationActionIncompatible();
	const [current] = await tx
		.select({ postTargetingLocked: unit.postTargetingLocked })
		.from(unit)
		.where(eq(unit.id, row.targetId))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationTargetNotFound();
	return {
		type: "unit_post_targeting_lock",
		previousPostTargetingLocked: current.postTargetingLocked,
		resultingPostTargetingLocked: resolvePostTargetingLockState(
			current.postTargetingLocked,
			action,
		),
	};
}

async function lockContentLicenseTargetUnit(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
): Promise<void> {
	if (row.targetKind !== "unit" || row.authority !== "platform")
		throw new ModerationActionIncompatible();
	const [target] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(eq(unit.id, row.targetId))
		.for("update")
		.limit(1);
	if (!target) throw new ModerationTargetNotFound();
}

async function loadContentLicenseInvalidationPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
): Promise<ContentLicenseActionPlan> {
	await lockContentLicenseTargetUnit(tx, row);
	const [current] = await tx
		.select({
			id: unitContentLicense.id,
			status: unitContentLicense.status,
		})
		.from(unitContentLicense)
		.where(
			and(
				eq(unitContentLicense.unitId, row.targetId),
				eq(unitContentLicense.status, "active"),
			),
		)
		.for("update")
		.limit(1);
	if (!current) throw new ModerationActionNoEffect();
	return {
		type: "unit_content_license_state",
		contentLicenseId: current.id,
		previousContentLicenseStatus: current.status,
		resultingContentLicenseStatus: resolveUnitContentLicenseStatus(
			current.status,
			"invalidate_content_license",
		),
	};
}

async function loadContentLicenseRestorationPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	reversesActionId: string,
): Promise<ContentLicenseActionPlan> {
	await lockContentLicenseTargetUnit(tx, row);
	const [invalidation] = await tx
		.select({
			id: moderationAction.id,
			caseId: moderationAction.caseId,
			kind: moderationAction.kind,
			contentLicenseId: moderationAction.contentLicenseId,
			previousContentLicenseStatus: moderationAction.previousContentLicenseStatus,
			resultingContentLicenseStatus: moderationAction.resultingContentLicenseStatus,
		})
		.from(moderationAction)
		.where(eq(moderationAction.id, reversesActionId))
		.limit(1);
	if (
		!invalidation ||
		invalidation.kind !== "invalidate_content_license" ||
		!invalidation.contentLicenseId ||
		invalidation.previousContentLicenseStatus !== "active" ||
		invalidation.resultingContentLicenseStatus !== "invalidated"
	)
		throw new ModerationReversedActionInvalid();
	const [invalidationCase] = await tx
		.select({
			authority: moderationCase.authority,
			targetKind: moderationCase.targetKind,
			targetId: moderationCase.targetId,
		})
		.from(moderationCase)
		.where(eq(moderationCase.id, invalidation.caseId))
		.limit(1);
	if (
		!invalidationCase ||
		invalidationCase.authority !== "platform" ||
		invalidationCase.targetKind !== "unit" ||
		invalidationCase.targetId !== row.targetId
	)
		throw new ModerationReversedActionInvalid();
	const [existingRestoration] = await tx
		.select({ id: moderationAction.id })
		.from(moderationAction)
		.where(eq(moderationAction.reversesActionId, invalidation.id))
		.limit(1);
	if (existingRestoration) throw new ModerationReversalUnavailable();
	const [current] = await tx
		.select({
			id: unitContentLicense.id,
			unitId: unitContentLicense.unitId,
			status: unitContentLicense.status,
		})
		.from(unitContentLicense)
		.where(eq(unitContentLicense.id, invalidation.contentLicenseId))
		.for("update")
		.limit(1);
	if (!current || current.unitId !== row.targetId) throw new ModerationReversedActionInvalid();
	if (current.status !== "invalidated") throw new ModerationReversalUnavailable();
	const [activeGrant] = await tx
		.select({ id: unitContentLicense.id })
		.from(unitContentLicense)
		.where(
			and(
				eq(unitContentLicense.unitId, row.targetId),
				eq(unitContentLicense.status, "active"),
			),
		)
		.limit(1);
	if (activeGrant) throw new ModerationReversalUnavailable();
	return {
		type: "unit_content_license_state",
		contentLicenseId: current.id,
		previousContentLicenseStatus: current.status,
		resultingContentLicenseStatus: resolveUnitContentLicenseStatus(
			current.status,
			"restore_content_license",
		),
	};
}

async function loadReversalPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	reversesActionId: string,
): Promise<ModerationActionPlan> {
	const [reversed] = await tx
		.select({
			id: moderationAction.id,
			caseId: moderationAction.caseId,
			kind: moderationAction.kind,
			previousState: moderationAction.previousState,
			resultingState: moderationAction.resultingState,
			previousPostTargetingLocked: moderationAction.previousPostTargetingLocked,
			resultingPostTargetingLocked: moderationAction.resultingPostTargetingLocked,
		})
		.from(moderationAction)
		.where(eq(moderationAction.id, reversesActionId))
		.limit(1);
	if (!reversed || reversed.caseId !== row.id) throw new ModerationReversedActionInvalid();
	const [existingReversal] = await tx
		.select({ id: moderationAction.id })
		.from(moderationAction)
		.where(eq(moderationAction.reversesActionId, reversed.id))
		.limit(1);
	if (existingReversal) throw new ModerationReversalUnavailable();
	if (reversed.kind === "reverse") throw new ModerationReversalUnavailable();

	if (reversed.previousState !== null && reversed.resultingState !== null) {
		if (row.targetKind === "unit" || row.targetKind === "unit_field") {
			if (
				!isUnitModerationStatus(reversed.previousState) ||
				!isUnitModerationStatus(reversed.resultingState)
			)
				throw new ModerationReversalUnavailable();
			const [current] = await tx
				.select({ state: unit.moderationStatus })
				.from(unit)
				.where(eq(unit.id, row.targetId))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.state !== reversed.resultingState)
				throw new ModerationReversalUnavailable();
			return {
				type: "unit_state",
				previousState: current.state,
				resultingState: reversed.previousState,
			};
		}
		if (row.targetKind === "realm_unit") {
			if (
				!isRealmUnitStatus(reversed.previousState) ||
				!isRealmUnitStatus(reversed.resultingState)
			)
				throw new ModerationReversalUnavailable();
			if (!row.realmId) throw new ModerationRealmMissing();
			const [current] = await tx
				.select({ state: realmUnit.status })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.state !== reversed.resultingState)
				throw new ModerationReversalUnavailable();
			return {
				type: "realm_unit_state",
				previousState: current.state,
				resultingState: reversed.previousState,
			};
		}
		if (row.targetKind === "realm_member") {
			if (
				!isRealmMemberState(reversed.previousState) ||
				!isRealmMemberState(reversed.resultingState)
			)
				throw new ModerationReversalUnavailable();
			if (!row.realmId) throw new ModerationRealmMissing();
			const [current] = await tx
				.select({ state: realmMember.state })
				.from(realmMember)
				.where(
					and(
						eq(realmMember.realmId, row.realmId),
						eq(realmMember.profileId, row.targetId),
					),
				)
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.state !== reversed.resultingState)
				throw new ModerationReversalUnavailable();
			return {
				type: "realm_member_state",
				previousState: current.state,
				resultingState: reversed.previousState,
			};
		}
	}

	if (
		reversed.previousPostTargetingLocked !== null &&
		reversed.resultingPostTargetingLocked !== null
	) {
		if (row.targetKind === "realm_unit") {
			if (!row.realmId) throw new ModerationRealmMissing();
			const [targetUnit] = await tx
				.select({ id: unit.id })
				.from(unit)
				.where(eq(unit.id, row.targetId))
				.for("share")
				.limit(1);
			if (!targetUnit) throw new ModerationTargetNotFound();
			const [current] = await tx
				.select({ postTargetingLocked: realmUnit.postTargetingLocked })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.postTargetingLocked !== reversed.resultingPostTargetingLocked)
				throw new ModerationReversalUnavailable();
			return {
				type: "realm_unit_post_targeting_lock",
				previousPostTargetingLocked: current.postTargetingLocked,
				resultingPostTargetingLocked: reversed.previousPostTargetingLocked,
			};
		}
		if (row.targetKind === "unit") {
			const [current] = await tx
				.select({ postTargetingLocked: unit.postTargetingLocked })
				.from(unit)
				.where(eq(unit.id, row.targetId))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.postTargetingLocked !== reversed.resultingPostTargetingLocked)
				throw new ModerationReversalUnavailable();
			return {
				type: "unit_post_targeting_lock",
				previousPostTargetingLocked: current.postTargetingLocked,
				resultingPostTargetingLocked: reversed.previousPostTargetingLocked,
			};
		}
	}
	throw new ModerationReversalUnavailable();
}

async function deriveActionPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	body: CreateModerationActionBody,
): Promise<ModerationActionPlan> {
	assertModerationActionCompatible(row.targetKind, body.kind);
	if (body.kind === "reverse") return loadReversalPlan(tx, row, body.reversesActionId);
	if (body.kind === "invalidate_content_license")
		return loadContentLicenseInvalidationPlan(tx, row);
	if (body.kind === "restore_content_license")
		return loadContentLicenseRestorationPlan(tx, row, body.reversesActionId);
	if (body.kind === "approve" || body.kind === "remove" || body.kind === "restore") {
		if (row.targetKind === "realm_unit") return loadRealmUnitStatePlan(tx, row, body.kind);
		return loadUnitStatePlan(tx, row, body.kind);
	}
	if (body.kind === "hide") return loadRealmUnitStatePlan(tx, row, body.kind);
	if (body.kind === "lock_post_targeting" || body.kind === "unlock_post_targeting")
		return loadPostTargetingLockPlan(tx, row, body.kind);
	if (
		body.kind === "mute_member" ||
		body.kind === "remove_member" ||
		body.kind === "ban_member" ||
		body.kind === "restore_member"
	)
		return loadMemberStatePlan(tx, row, body.kind);
	resolveModerationCaseState(row.state, body.kind);
	return { type: "case_only" };
}

async function executeActionPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	plan: ModerationActionPlan,
	input: {
		actorProfileId: string;
		actionId: string;
		reasonCode: CreateModerationActionBody["reasonCode"];
	},
): Promise<void> {
	if (plan.type === "unit_state") {
		const [updated] = await tx
			.update(unit)
			.set({ moderationStatus: plan.resultingState })
			.where(and(eq(unit.id, row.targetId), eq(unit.moderationStatus, plan.previousState)))
			.returning({ id: unit.id });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "realm_unit_state") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [updated] = await tx
			.update(realmUnit)
			.set({ status: plan.resultingState })
			.where(
				and(
					eq(realmUnit.realmId, row.realmId),
					eq(realmUnit.unitId, row.targetId),
					eq(realmUnit.status, plan.previousState),
				),
			)
			.returning({ unitId: realmUnit.unitId });
		if (!updated) throw new ModerationTransitionInvalid();
		await tx.insert(realmUnitStatusEvent).values({
			realmId: row.realmId,
			unitId: row.targetId,
			fromStatus: plan.previousState,
			toStatus: plan.resultingState,
			changedByProfileId: input.actorProfileId,
			moderationActionId: input.actionId,
		});
		return;
	}
	if (plan.type === "realm_member_state") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [updated] = await tx
			.update(realmMember)
			.set({ state: plan.resultingState })
			.where(
				and(
					eq(realmMember.realmId, row.realmId),
					eq(realmMember.profileId, row.targetId),
					eq(realmMember.state, plan.previousState),
				),
			)
			.returning({ profileId: realmMember.profileId });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "unit_post_targeting_lock") {
		const [updated] = await tx
			.update(unit)
			.set({ postTargetingLocked: plan.resultingPostTargetingLocked })
			.where(
				and(
					eq(unit.id, row.targetId),
					eq(unit.postTargetingLocked, plan.previousPostTargetingLocked),
				),
			)
			.returning({ id: unit.id });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "realm_unit_post_targeting_lock") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [updated] = await tx
			.update(realmUnit)
			.set({ postTargetingLocked: plan.resultingPostTargetingLocked })
			.where(
				and(
					eq(realmUnit.realmId, row.realmId),
					eq(realmUnit.unitId, row.targetId),
					eq(realmUnit.postTargetingLocked, plan.previousPostTargetingLocked),
				),
			)
			.returning({ unitId: realmUnit.unitId });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "unit_content_license_state") {
		const [updated] = await tx
			.update(unitContentLicense)
			.set({ status: plan.resultingContentLicenseStatus })
			.where(
				and(
					eq(unitContentLicense.id, plan.contentLicenseId),
					eq(unitContentLicense.unitId, row.targetId),
					eq(unitContentLicense.status, plan.previousContentLicenseStatus),
				),
			)
			.returning({ id: unitContentLicense.id });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
}

export async function executeAuthorizedModerationAction(
	tx: DatabaseTransaction,
	input: {
		caseRow: ModerationCaseRecord;
		actorProfileId: string;
		body: CreateModerationActionBody;
	},
) {
	const fingerprint = fingerprintModerationAction(input.body);
	if (input.body.idempotencyKey) {
		const [existing] = await tx
			.select({
				...moderationActionSelection,
				requestFingerprint: moderationAction.requestFingerprint,
			})
			.from(moderationAction)
			.where(
				and(
					eq(moderationAction.actorProfileId, input.actorProfileId),
					eq(moderationAction.caseId, input.caseRow.id),
					eq(moderationAction.idempotencyKey, input.body.idempotencyKey),
				),
			)
			.limit(1);
		if (existing) {
			if (existing.requestFingerprint !== fingerprint)
				throw new ModerationIdempotencyConflict();
			const { requestFingerprint: _requestFingerprint, ...created } = existing;
			const notes = (
				await listGovernanceNotes(tx, {
					subjectKind: "moderation_action",
					subjectIds: [created.id],
				})
			).map(({ postId, role }) => ({ postId, role }));
			return { created: { ...created, notes }, replayed: true };
		}
	}

	const noteRoles = new Set(input.body.notes?.map((note) => note.role));
	if (noteRoles.size !== (input.body.notes?.length ?? 0)) throw new ModerationNoteRoleDuplicate();
	const target = await getModerationTargetContext(tx, input.caseRow);
	const caseReports =
		input.caseRow.authority === "platform"
			? (
					await tx
						.select({
							id: platformUnitReport.id,
							reporterProfileId: platformUnitReport.reporterProfileId,
						})
						.from(platformUnitReport)
						.where(eq(platformUnitReport.caseId, input.caseRow.id))
				).map((row) => ({ ...row, scope: "platform" as const }))
			: (
					await tx
						.select({
							id: realmUnitReport.id,
							reporterProfileId: realmUnitReport.reporterProfileId,
						})
						.from(realmUnitReport)
						.where(eq(realmUnitReport.caseId, input.caseRow.id))
				).map((row) => ({ ...row, scope: "realm" as const }));
	const reportRecipientProfileIds = presentProfileIds(
		caseReports.map(({ reporterProfileId }) => ({ profileId: reporterProfileId })),
	);
	if (input.body.kind === "dismiss")
		assertReportCaseDismissible(input.caseRow.state, caseReports.length);
	const plan = await deriveActionPlan(tx, input.caseRow, input.body);
	const previousState =
		plan.type === "unit_state" ||
		plan.type === "realm_unit_state" ||
		plan.type === "realm_member_state"
			? plan.previousState
			: null;
	const resultingState =
		plan.type === "unit_state" ||
		plan.type === "realm_unit_state" ||
		plan.type === "realm_member_state"
			? plan.resultingState
			: null;
	const isPostTargetingLockPlan =
		plan.type === "unit_post_targeting_lock" || plan.type === "realm_unit_post_targeting_lock";
	const previousPostTargetingLocked = isPostTargetingLockPlan
		? plan.previousPostTargetingLocked
		: null;
	const resultingPostTargetingLocked = isPostTargetingLockPlan
		? plan.resultingPostTargetingLocked
		: null;
	const isContentLicensePlan = plan.type === "unit_content_license_state";
	const contentLicenseId = isContentLicensePlan ? plan.contentLicenseId : null;
	const previousContentLicenseStatus = isContentLicensePlan
		? plan.previousContentLicenseStatus
		: null;
	const resultingContentLicenseStatus = isContentLicensePlan
		? plan.resultingContentLicenseStatus
		: null;
	const [created] = await tx
		.insert(moderationAction)
		.values({
			caseId: input.caseRow.id,
			actorProfileId: input.actorProfileId,
			kind: input.body.kind,
			previousState,
			resultingState,
			previousPostTargetingLocked,
			contentLicenseId,
			previousContentLicenseStatus,
			resultingContentLicenseStatus,
			resultingStatus: plan.type === "unit_state" ? plan.resultingState : null,
			resultingPostTargetingLocked,
			reasonCode: input.body.reasonCode,
			reversesActionId:
				input.body.kind === "reverse" || input.body.kind === "restore_content_license"
					? input.body.reversesActionId
					: undefined,
			idempotencyKey: input.body.idempotencyKey,
			requestFingerprint: fingerprint,
		})
		.returning(moderationActionSelection);
	if (!created) throw new Error("Moderation action insertion did not return a row");
	const noteBindings: Array<{
		postId: string;
		role: "internal_note" | "public_notice";
	}> = [];
	const createNotes = async () => {
		for (const note of input.body.notes ?? []) {
			const binding = await createGovernanceNotePost(tx, {
				actorProfileId: input.actorProfileId,
				subjectKind: "moderation_action",
				subjectId: created.id,
				subjectUnitId: target.subjectUnitId,
				realmId: input.caseRow.realmId,
				publicRecipientProfileIds: [
					...new Set([...target.recipientProfileIds, ...reportRecipientProfileIds]),
				],
				note,
			});
			noteBindings.push({ ...binding, role: note.role });
		}
	};
	if (isPostTargetingLockPlan && plan.resultingPostTargetingLocked) await createNotes();
	await executeActionPlan(tx, input.caseRow, plan, {
		actorProfileId: input.actorProfileId,
		actionId: created.id,
		reasonCode: input.body.reasonCode,
	});
	if (!(isPostTargetingLockPlan && plan.resultingPostTargetingLocked)) await createNotes();
	const notePostIds = noteBindings.map((binding) => binding.postId);
	const nextCaseState = resolveModerationCaseState(input.caseRow.state, input.body.kind);
	if (nextCaseState !== input.caseRow.state)
		await tx
			.update(moderationCase)
			.set({ state: nextCaseState })
			.where(eq(moderationCase.id, input.caseRow.id));
	const publicNoticePostId = noteBindings.find(
		(binding) => binding.role === "public_notice",
	)?.postId;
	if ((input.body.kind !== "note" || publicNoticePostId) && input.body.kind !== "dismiss")
		for (const recipientProfileId of target.recipientProfileIds) {
			await createNotification(tx, {
				recipientProfileId,
				actorProfileId: input.actorProfileId,
				kind: "moderation",
				subjectUnitId: target.subjectUnitId,
				payload: {
					type: "moderation_action",
					actionId: created.id,
					actionKind: input.body.kind,
					reasonCode: input.body.reasonCode,
					publicNoticePostId,
				},
			});
		}
	if (input.body.kind !== "note" && !isActiveReportCaseState(nextCaseState))
		for (const caseReport of caseReports) {
			await createNotification(tx, {
				recipientProfileId: caseReport.reporterProfileId,
				actorProfileId: input.actorProfileId,
				kind: "moderation",
				subjectUnitId: target.subjectUnitId,
				payload: {
					type: "report_resolution",
					reportId: caseReport.id,
					reportScope: caseReport.scope,
					actionId: created.id,
					actionKind: input.body.kind,
					reasonCode: input.body.reasonCode,
					publicNoticePostId,
				},
			});
		}
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority:
			input.caseRow.authority === "realm" && input.caseRow.realmId
				? { kind: "realm", id: input.caseRow.realmId }
				: { kind: "platform" },
		action: `moderation.${input.body.kind}`,
		reasonCode: input.body.reasonCode,
		target: {
			kind: input.caseRow.targetKind,
			id: input.caseRow.targetId,
			path: input.caseRow.targetPath ?? undefined,
		},
		details: {
			moderationActionId: created.id,
			caseId: input.caseRow.id,
			realmId: input.caseRow.realmId,
			notePostIds,
		},
	});
	return { created: { ...created, notes: noteBindings }, replayed: false };
}
