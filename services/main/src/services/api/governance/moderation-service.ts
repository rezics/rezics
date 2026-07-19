import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import {
	auditEvent,
	feedback,
	moderationAction,
	moderationCase,
	post,
	profile as profileTable,
	realmMember,
	realmUnit,
	realmUnitStatusEvent,
	unit,
	unitAccessBinding,
	unitProtection,
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
	assertModerationActionCompatible,
	resolveLockState,
	resolveModerationCaseState,
	resolveRealmMemberState,
	resolveRealmUnitStatus,
	resolveUnitModerationStatus,
	type RealmMemberState,
	type RealmUnitStatus,
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
	previousLocked: moderationAction.previousLocked,
	resultingStatus: moderationAction.resultingStatus,
	resultingLocked: moderationAction.resultingLocked,
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
	type: "post_lock" | "realm_unit_lock";
	previousLocked: boolean;
	resultingLocked: boolean;
};

type ProtectionActionPlan =
	| {
			type: "protect";
			scope: string[];
			mode: "frozen" | "owner_only";
	  }
	| { type: "unprotect"; scope: string[] };

type ModerationActionPlan =
	StateActionPlan | LockActionPlan | ProtectionActionPlan | { type: "case_only" };

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
			.select({ profileId: unitAccessBinding.profileId })
			.from(unitAccessBinding)
			.where(
				and(
					eq(unitAccessBinding.unitId, target.id),
					eq(unitAccessBinding.role, "owner"),
					isNull(unitAccessBinding.revokedAt),
				),
			);
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
			.select({ profileId: unitAccessBinding.profileId })
			.from(unitAccessBinding)
			.where(
				and(
					eq(unitAccessBinding.unitId, target.unitId),
					eq(unitAccessBinding.role, "owner"),
					isNull(unitAccessBinding.revokedAt),
				),
			);
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
	const [target] = await tx
		.select({ profileId: feedback.profileId, subjectUnitId: feedback.subjectUnitId })
		.from(feedback)
		.where(eq(feedback.id, row.targetId))
		.limit(1);
	if (!target) throw new ModerationTargetNotFound();
	return {
		recipientProfileIds: [target.profileId],
		subjectUnitId: target.subjectUnitId ?? undefined,
	};
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

async function loadLockPlan(
	tx: DatabaseTransaction,
	row: ModerationCaseRecord,
	action: "lock" | "unlock",
): Promise<LockActionPlan> {
	if (row.targetKind === "realm_unit") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [current] = await tx
			.select({ locked: realmUnit.locked })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
			.for("update")
			.limit(1);
		if (!current) throw new ModerationTargetNotFound();
		return {
			type: "realm_unit_lock",
			previousLocked: current.locked,
			resultingLocked: resolveLockState(current.locked, action),
		};
	}
	const [current] = await tx
		.select({ locked: post.locked })
		.from(post)
		.where(eq(post.id, row.targetId))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationActionIncompatible();
	return {
		type: "post_lock",
		previousLocked: current.locked,
		resultingLocked: resolveLockState(current.locked, action),
	};
}

async function loadProtectionPlan(
	tx: DatabaseTransaction,
	body: Extract<CreateModerationActionBody, { kind: "protect" | "unprotect" }>,
	row: ModerationCaseRecord,
): Promise<ProtectionActionPlan> {
	const [active] = await tx
		.select({ mode: unitProtection.mode })
		.from(unitProtection)
		.where(
			and(
				eq(unitProtection.unitId, row.targetId),
				eq(unitProtection.scope, body.scope),
				isNull(unitProtection.revokedAt),
			),
		)
		.for("update")
		.limit(1);
	if (body.kind === "unprotect") {
		if (!active) throw new ModerationActionNoEffect();
		return { type: "unprotect", scope: body.scope };
	}
	if (active?.mode === body.protectionMode) throw new ModerationActionNoEffect();
	return {
		type: "protect",
		scope: body.scope,
		mode: body.protectionMode,
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
			previousLocked: moderationAction.previousLocked,
			resultingLocked: moderationAction.resultingLocked,
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

	if (reversed.previousLocked !== null && reversed.resultingLocked !== null) {
		if (row.targetKind === "realm_unit") {
			if (!row.realmId) throw new ModerationRealmMissing();
			const [current] = await tx
				.select({ locked: realmUnit.locked })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.locked !== reversed.resultingLocked)
				throw new ModerationReversalUnavailable();
			return {
				type: "realm_unit_lock",
				previousLocked: current.locked,
				resultingLocked: reversed.previousLocked,
			};
		}
		if (row.targetKind === "unit" || row.targetKind === "unit_field") {
			const [current] = await tx
				.select({ locked: post.locked })
				.from(post)
				.where(eq(post.id, row.targetId))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.locked !== reversed.resultingLocked)
				throw new ModerationReversalUnavailable();
			return {
				type: "post_lock",
				previousLocked: current.locked,
				resultingLocked: reversed.previousLocked,
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
	if (body.kind === "approve" || body.kind === "remove" || body.kind === "restore") {
		if (row.targetKind === "realm_unit") return loadRealmUnitStatePlan(tx, row, body.kind);
		return loadUnitStatePlan(tx, row, body.kind);
	}
	if (body.kind === "hide") return loadRealmUnitStatePlan(tx, row, body.kind);
	if (body.kind === "lock" || body.kind === "unlock") return loadLockPlan(tx, row, body.kind);
	if (
		body.kind === "mute_member" ||
		body.kind === "remove_member" ||
		body.kind === "ban_member" ||
		body.kind === "restore_member"
	)
		return loadMemberStatePlan(tx, row, body.kind);
	if (body.kind === "protect" || body.kind === "unprotect")
		return loadProtectionPlan(tx, body, row);
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
	if (plan.type === "post_lock") {
		const [updated] = await tx
			.update(post)
			.set({ locked: plan.resultingLocked })
			.where(and(eq(post.id, row.targetId), eq(post.locked, plan.previousLocked)))
			.returning({ id: post.id });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "realm_unit_lock") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [updated] = await tx
			.update(realmUnit)
			.set({ locked: plan.resultingLocked })
			.where(
				and(
					eq(realmUnit.realmId, row.realmId),
					eq(realmUnit.unitId, row.targetId),
					eq(realmUnit.locked, plan.previousLocked),
				),
			)
			.returning({ unitId: realmUnit.unitId });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
	if (plan.type === "protect") {
		await tx
			.update(unitProtection)
			.set({ revokedAt: new Date(), revokedByProfileId: input.actorProfileId })
			.where(
				and(
					eq(unitProtection.unitId, row.targetId),
					eq(unitProtection.scope, plan.scope),
					isNull(unitProtection.revokedAt),
				),
			);
		await tx.insert(unitProtection).values({
			unitId: row.targetId,
			scope: plan.scope,
			mode: plan.mode,
			createdByProfileId: input.actorProfileId,
			reasonCode: input.reasonCode,
		});
		return;
	}
	if (plan.type === "unprotect") {
		const rows = await tx
			.update(unitProtection)
			.set({ revokedAt: new Date(), revokedByProfileId: input.actorProfileId })
			.where(
				and(
					eq(unitProtection.unitId, row.targetId),
					eq(unitProtection.scope, plan.scope),
					isNull(unitProtection.revokedAt),
				),
			)
			.returning({ id: unitProtection.id });
		if (!rows.length) throw new ModerationActionNoEffect();
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
			).map(({ postId, revisionId, role }) => ({ postId, revisionId, role }));
			return { created: { ...created, notes }, notificationIds: [], replayed: true };
		}
	}

	const noteRoles = new Set(input.body.notes?.map((note) => note.role));
	if (noteRoles.size !== (input.body.notes?.length ?? 0)) throw new ModerationNoteRoleDuplicate();
	const target = await getModerationTargetContext(tx, input.caseRow);
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
	const previousLocked =
		plan.type === "post_lock" || plan.type === "realm_unit_lock" ? plan.previousLocked : null;
	const resultingLocked =
		plan.type === "post_lock" || plan.type === "realm_unit_lock" ? plan.resultingLocked : null;
	const [created] = await tx
		.insert(moderationAction)
		.values({
			caseId: input.caseRow.id,
			actorProfileId: input.actorProfileId,
			kind: input.body.kind,
			previousState,
			resultingState,
			previousLocked,
			resultingStatus: plan.type === "unit_state" ? plan.resultingState : null,
			resultingLocked,
			reasonCode: input.body.reasonCode,
			reversesActionId:
				input.body.kind === "reverse" ? input.body.reversesActionId : undefined,
			idempotencyKey: input.body.idempotencyKey,
			requestFingerprint: fingerprint,
		})
		.returning(moderationActionSelection);
	if (!created) throw new Error("Moderation action insertion did not return a row");
	await executeActionPlan(tx, input.caseRow, plan, {
		actorProfileId: input.actorProfileId,
		actionId: created.id,
		reasonCode: input.body.reasonCode,
	});
	const noteBindings: Array<{
		postId: string;
		revisionId: string;
		role: "internal_note" | "public_notice";
	}> = [];
	for (const note of input.body.notes ?? []) {
		const binding = await createGovernanceNotePost(tx, {
			actorProfileId: input.actorProfileId,
			subjectKind: "moderation_action",
			subjectId: created.id,
			subjectUnitId: target.subjectUnitId,
			realmId: input.caseRow.realmId,
			publicRecipientProfileIds: target.recipientProfileIds,
			note,
		});
		noteBindings.push({ ...binding, role: note.role });
	}
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
	const notificationIds: string[] = [];
	if (input.body.kind !== "note" || publicNoticePostId)
		for (const recipientProfileId of target.recipientProfileIds) {
			const notificationId = await createNotification(tx, {
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
			if (notificationId) notificationIds.push(notificationId);
		}
	await tx.insert(auditEvent).values({
		actorProfileId: input.actorProfileId,
		action: `moderation.${input.body.kind}`,
		decisionCode: input.body.reasonCode,
		subjectKind: input.caseRow.targetKind,
		subjectId: input.caseRow.targetId,
		subjectPath: input.caseRow.targetPath,
		metadata: {
			moderationActionId: created.id,
			caseId: input.caseRow.id,
			realmId: input.caseRow.realmId,
			notePostIds,
		},
	});
	return { created: { ...created, notes: noteBindings }, notificationIds, replayed: false };
}
