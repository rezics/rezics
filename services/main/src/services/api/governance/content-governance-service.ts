import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import type { DatabaseTransaction } from "../../database";
import {
	contentGovernanceAction,
	contentReport,
	contentReportReferral,
	contentReviewCase,
	realmUnit,
	realmUnitStatusEvent,
	unit,
	unitContentLicense,
	unitOwnership,
} from "../../database/schema";
import { createGovernanceNotePost, listGovernanceNotes } from "../../governance/note-service";
import {
	createGovernanceDecision,
	listGovernanceDecisionRules,
	type GovernanceAuthority,
} from "../../governance/decision-service";
import { createNotification } from "../../notifications/service";
import {
	ContentGovernanceActionIncompatible as ModerationActionIncompatible,
	ContentGovernanceActionNoEffect as ModerationActionNoEffect,
	ContentGovernanceIdempotencyConflict as ModerationIdempotencyConflict,
	ContentGovernanceReversalUnavailable as ModerationReversalUnavailable,
	ContentGovernanceReversedActionInvalid as ModerationReversedActionInvalid,
	ContentGovernanceTargetNotFound as ModerationTargetNotFound,
	ContentGovernanceTransitionInvalid as ModerationTransitionInvalid,
	ContentReviewRealmMissing as ModerationRealmMissing,
	GovernanceNoteRoleDuplicate as ModerationNoteRoleDuplicate,
} from "./errors";
import {
	assertContentGovernanceActionCompatible,
	isActiveContentReviewCaseState,
	resolvePostTargetingLockState,
	resolveRealmUnitStatus,
	resolveUnitContentLicenseStatus,
	resolveUnitModerationStatus,
	type RealmUnitStatus,
	type UnitContentLicenseStatus,
	type UnitModerationStatus,
} from "./content-governance-contract";
import type { CreateContentGovernanceActionBody, ContentGovernanceActionResponse } from "./schema";

export const contentGovernanceActionSelection = {
	id: contentGovernanceAction.id,
	caseId: contentGovernanceAction.caseId,
	actorProfileId: contentGovernanceAction.actorProfileId,
	kind: contentGovernanceAction.kind,
	previousState: contentGovernanceAction.previousState,
	resultingState: contentGovernanceAction.resultingState,
	previousPostTargetingLocked: contentGovernanceAction.previousPostTargetingLocked,
	contentLicenseId: contentGovernanceAction.contentLicenseId,
	previousContentLicenseStatus: contentGovernanceAction.previousContentLicenseStatus,
	resultingContentLicenseStatus: contentGovernanceAction.resultingContentLicenseStatus,
	resultingPostTargetingLocked: contentGovernanceAction.resultingPostTargetingLocked,
	reversesActionId: contentGovernanceAction.reversesActionId,
	createdAt: contentGovernanceAction.createdAt,
};

function contentGovernanceAuthority(row: ContentReviewCaseRecord): GovernanceAuthority {
	return row.authority === "realm" && row.realmId
		? { kind: "realm", realmId: row.realmId }
		: { kind: "platform" };
}

export type ContentReviewCaseRecord = typeof contentReviewCase.$inferSelect;

type ModerationTargetContext = {
	recipientProfileIds: readonly string[];
	subjectUnitId: string;
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

type ContentGovernanceActionPlan = StateActionPlan | LockActionPlan | ContentLicenseActionPlan;

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

export function fingerprintContentGovernanceAction(
	body: CreateContentGovernanceActionBody,
): string {
	const { idempotencyKey: _idempotencyKey, ...request } = body;
	return createHash("sha256")
		.update(JSON.stringify(canonicalize(request)))
		.digest("hex");
}

export async function loadContentReviewCaseForAction(
	tx: DatabaseTransaction,
	caseId: string,
): Promise<ContentReviewCaseRecord | undefined> {
	const [row] = await tx
		.select()
		.from(contentReviewCase)
		.where(eq(contentReviewCase.id, caseId))
		.for("update")
		.limit(1);
	return row;
}

async function getModerationTargetContext(
	tx: DatabaseTransaction,
	row: ContentReviewCaseRecord,
): Promise<ModerationTargetContext> {
	if (row.authority === "realm") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [target] = await tx
			.select({ unitId: realmUnit.unitId })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetUnitId)))
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
	const [target] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(eq(unit.id, row.targetUnitId))
		.limit(1);
	if (!target) throw new ModerationTargetNotFound();
	const owners = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, target.id), isNull(unitOwnership.revokedAt)));
	return { recipientProfileIds: presentProfileIds(owners), subjectUnitId: target.id };
}

async function loadUnitStatePlan(
	tx: DatabaseTransaction,
	row: ContentReviewCaseRecord,
	action: "approve" | "remove" | "restore",
): Promise<StateActionPlan> {
	const [current] = await tx
		.select({ status: unit.moderationStatus })
		.from(unit)
		.where(eq(unit.id, row.targetUnitId))
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
	row: ContentReviewCaseRecord,
	action: "approve" | "hide" | "remove" | "restore",
): Promise<StateActionPlan> {
	if (!row.realmId) throw new ModerationRealmMissing();
	const [current] = await tx
		.select({ status: realmUnit.status })
		.from(realmUnit)
		.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetUnitId)))
		.for("update")
		.limit(1);
	if (!current) throw new ModerationTargetNotFound();
	return {
		type: "realm_unit_state",
		previousState: current.status,
		resultingState: resolveRealmUnitStatus(current.status, action),
	};
}

async function loadPostTargetingLockPlan(
	tx: DatabaseTransaction,
	row: ContentReviewCaseRecord,
	action: "lock_post_targeting" | "unlock_post_targeting",
): Promise<LockActionPlan> {
	if (row.authority === "realm") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [targetUnit] = await tx
			.select({ id: unit.id })
			.from(unit)
			.where(eq(unit.id, row.targetUnitId))
			.for("share")
			.limit(1);
		if (!targetUnit) throw new ModerationTargetNotFound();
		const [current] = await tx
			.select({ postTargetingLocked: realmUnit.postTargetingLocked })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetUnitId)))
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
	const [current] = await tx
		.select({ postTargetingLocked: unit.postTargetingLocked })
		.from(unit)
		.where(eq(unit.id, row.targetUnitId))
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
	row: ContentReviewCaseRecord,
): Promise<void> {
	if (row.authority !== "platform") throw new ModerationActionIncompatible();
	const [target] = await tx
		.select({ id: unit.id })
		.from(unit)
		.where(eq(unit.id, row.targetUnitId))
		.for("update")
		.limit(1);
	if (!target) throw new ModerationTargetNotFound();
}

async function loadContentLicenseInvalidationPlan(
	tx: DatabaseTransaction,
	row: ContentReviewCaseRecord,
): Promise<ContentLicenseActionPlan> {
	await lockContentLicenseTargetUnit(tx, row);
	const [current] = await tx
		.select({
			id: unitContentLicense.id,
			status: unitContentLicense.status,
		})
		.from(unitContentLicense)
		.where(
			and(eq(unitContentLicense.unitId, row.targetUnitId), eq(unitContentLicense.status, "active")),
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
	row: ContentReviewCaseRecord,
	reversesActionId: string,
): Promise<ContentLicenseActionPlan> {
	await lockContentLicenseTargetUnit(tx, row);
	const [invalidation] = await tx
		.select({
			id: contentGovernanceAction.id,
			caseId: contentGovernanceAction.caseId,
			kind: contentGovernanceAction.kind,
			contentLicenseId: contentGovernanceAction.contentLicenseId,
			previousContentLicenseStatus: contentGovernanceAction.previousContentLicenseStatus,
			resultingContentLicenseStatus: contentGovernanceAction.resultingContentLicenseStatus,
		})
		.from(contentGovernanceAction)
		.where(eq(contentGovernanceAction.id, reversesActionId))
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
			authority: contentReviewCase.authority,
			targetUnitId: contentReviewCase.targetUnitId,
		})
		.from(contentReviewCase)
		.where(eq(contentReviewCase.id, invalidation.caseId))
		.limit(1);
	if (
		!invalidationCase ||
		invalidationCase.authority !== "platform" ||
		invalidationCase.targetUnitId !== row.targetUnitId
	)
		throw new ModerationReversedActionInvalid();
	const [existingRestoration] = await tx
		.select({ id: contentGovernanceAction.id })
		.from(contentGovernanceAction)
		.where(eq(contentGovernanceAction.reversesActionId, invalidation.id))
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
	if (!current || current.unitId !== row.targetUnitId) throw new ModerationReversedActionInvalid();
	if (current.status !== "invalidated") throw new ModerationReversalUnavailable();
	const [activeGrant] = await tx
		.select({ id: unitContentLicense.id })
		.from(unitContentLicense)
		.where(
			and(eq(unitContentLicense.unitId, row.targetUnitId), eq(unitContentLicense.status, "active")),
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
	row: ContentReviewCaseRecord,
	reversesActionId: string,
): Promise<ContentGovernanceActionPlan> {
	const [reversed] = await tx
		.select({
			id: contentGovernanceAction.id,
			caseId: contentGovernanceAction.caseId,
			kind: contentGovernanceAction.kind,
			previousState: contentGovernanceAction.previousState,
			resultingState: contentGovernanceAction.resultingState,
			previousPostTargetingLocked: contentGovernanceAction.previousPostTargetingLocked,
			resultingPostTargetingLocked: contentGovernanceAction.resultingPostTargetingLocked,
		})
		.from(contentGovernanceAction)
		.where(eq(contentGovernanceAction.id, reversesActionId))
		.limit(1);
	if (!reversed || reversed.caseId !== row.id) throw new ModerationReversedActionInvalid();
	const [existingReversal] = await tx
		.select({ id: contentGovernanceAction.id })
		.from(contentGovernanceAction)
		.where(eq(contentGovernanceAction.reversesActionId, reversed.id))
		.limit(1);
	if (existingReversal) throw new ModerationReversalUnavailable();
	if (reversed.kind === "reverse") throw new ModerationReversalUnavailable();

	if (reversed.previousState !== null && reversed.resultingState !== null) {
		if (row.authority === "platform") {
			if (
				!isUnitModerationStatus(reversed.previousState) ||
				!isUnitModerationStatus(reversed.resultingState)
			)
				throw new ModerationReversalUnavailable();
			const [current] = await tx
				.select({ state: unit.moderationStatus })
				.from(unit)
				.where(eq(unit.id, row.targetUnitId))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.state !== reversed.resultingState) throw new ModerationReversalUnavailable();
			return {
				type: "unit_state",
				previousState: current.state,
				resultingState: reversed.previousState,
			};
		}
		if (row.authority === "realm") {
			if (!isRealmUnitStatus(reversed.previousState) || !isRealmUnitStatus(reversed.resultingState))
				throw new ModerationReversalUnavailable();
			if (!row.realmId) throw new ModerationRealmMissing();
			const [current] = await tx
				.select({ state: realmUnit.status })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetUnitId)))
				.for("update")
				.limit(1);
			if (!current) throw new ModerationTargetNotFound();
			if (current.state !== reversed.resultingState) throw new ModerationReversalUnavailable();
			return {
				type: "realm_unit_state",
				previousState: current.state,
				resultingState: reversed.previousState,
			};
		}
	}

	if (
		reversed.previousPostTargetingLocked !== null &&
		reversed.resultingPostTargetingLocked !== null
	) {
		if (row.authority === "realm") {
			if (!row.realmId) throw new ModerationRealmMissing();
			const [targetUnit] = await tx
				.select({ id: unit.id })
				.from(unit)
				.where(eq(unit.id, row.targetUnitId))
				.for("share")
				.limit(1);
			if (!targetUnit) throw new ModerationTargetNotFound();
			const [current] = await tx
				.select({ postTargetingLocked: realmUnit.postTargetingLocked })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetUnitId)))
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
		if (row.authority === "platform") {
			const [current] = await tx
				.select({ postTargetingLocked: unit.postTargetingLocked })
				.from(unit)
				.where(eq(unit.id, row.targetUnitId))
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
	row: ContentReviewCaseRecord,
	body: CreateContentGovernanceActionBody,
): Promise<ContentGovernanceActionPlan> {
	assertContentGovernanceActionCompatible(row.authority, body.kind);
	if (body.kind === "reverse") return loadReversalPlan(tx, row, body.reversesActionId);
	if (body.kind === "invalidate_content_license")
		return loadContentLicenseInvalidationPlan(tx, row);
	if (body.kind === "restore_content_license")
		return loadContentLicenseRestorationPlan(tx, row, body.reversesActionId);
	if (body.kind === "approve" || body.kind === "remove" || body.kind === "restore") {
		if (row.authority === "realm") return loadRealmUnitStatePlan(tx, row, body.kind);
		return loadUnitStatePlan(tx, row, body.kind);
	}
	if (body.kind === "hide") return loadRealmUnitStatePlan(tx, row, body.kind);
	if (body.kind === "lock_post_targeting" || body.kind === "unlock_post_targeting")
		return loadPostTargetingLockPlan(tx, row, body.kind);
	throw new ModerationActionIncompatible();
}

async function executeActionPlan(
	tx: DatabaseTransaction,
	row: ContentReviewCaseRecord,
	plan: ContentGovernanceActionPlan,
	input: {
		actorProfileId: string;
		actionId: string;
	},
): Promise<void> {
	if (plan.type === "unit_state") {
		const [updated] = await tx
			.update(unit)
			.set({ moderationStatus: plan.resultingState })
			.where(and(eq(unit.id, row.targetUnitId), eq(unit.moderationStatus, plan.previousState)))
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
					eq(realmUnit.unitId, row.targetUnitId),
					eq(realmUnit.status, plan.previousState),
				),
			)
			.returning({ unitId: realmUnit.unitId });
		if (!updated) throw new ModerationTransitionInvalid();
		await tx.insert(realmUnitStatusEvent).values({
			realmId: row.realmId,
			unitId: row.targetUnitId,
			fromStatus: plan.previousState,
			toStatus: plan.resultingState,
			changedByProfileId: input.actorProfileId,
			contentGovernanceActionId: input.actionId,
		});
		return;
	}
	if (plan.type === "unit_post_targeting_lock") {
		const [updated] = await tx
			.update(unit)
			.set({ postTargetingLocked: plan.resultingPostTargetingLocked })
			.where(
				and(
					eq(unit.id, row.targetUnitId),
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
					eq(realmUnit.unitId, row.targetUnitId),
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
					eq(unitContentLicense.unitId, row.targetUnitId),
					eq(unitContentLicense.status, plan.previousContentLicenseStatus),
				),
			)
			.returning({ id: unitContentLicense.id });
		if (!updated) throw new ModerationTransitionInvalid();
		return;
	}
}

export async function executeAuthorizedContentGovernanceAction(
	tx: DatabaseTransaction,
	input: {
		caseRow: ContentReviewCaseRecord;
		actorProfileId: string;
		body: CreateContentGovernanceActionBody;
	},
) {
	const fingerprint = fingerprintContentGovernanceAction(input.body);
	if (input.body.idempotencyKey) {
		const [existing] = await tx
			.select({
				...contentGovernanceActionSelection,
				decisionId: contentGovernanceAction.decisionId,
				requestFingerprint: contentGovernanceAction.requestFingerprint,
			})
			.from(contentGovernanceAction)
			.where(
				and(
					eq(contentGovernanceAction.actorProfileId, input.actorProfileId),
					eq(contentGovernanceAction.caseId, input.caseRow.id),
					eq(contentGovernanceAction.idempotencyKey, input.body.idempotencyKey),
				),
			)
			.limit(1);
		if (existing) {
			if (existing.requestFingerprint !== fingerprint) throw new ModerationIdempotencyConflict();
			const { requestFingerprint: _requestFingerprint, decisionId, ...created } = existing;
			const notes = (
				await listGovernanceNotes(tx, {
					subjectKind: "content_governance_action",
					subjectIds: [created.id],
				})
			).map(({ postId, role }) => ({ postId, role }));
			const rules = decisionId ? await listGovernanceDecisionRules(tx, decisionId) : [];
			const response = { ...created, rules, notes } satisfies ContentGovernanceActionResponse;
			return { created: response, replayed: true };
		}
	}

	const noteRoles = new Set(input.body.notes?.map((note) => note.role));
	if (noteRoles.size !== (input.body.notes?.length ?? 0)) throw new ModerationNoteRoleDuplicate();
	const target = await getModerationTargetContext(tx, input.caseRow);
	const caseReports = await tx
		.select({
			referralId: contentReportReferral.id,
			reportId: contentReport.id,
			reporterProfileId: contentReport.reporterProfileId,
		})
		.from(contentReportReferral)
		.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
		.where(eq(contentReportReferral.caseId, input.caseRow.id));
	const reportRecipientProfileIds = presentProfileIds(
		caseReports.map(({ reporterProfileId }) => ({ profileId: reporterProfileId })),
	);
	const plan = await deriveActionPlan(tx, input.caseRow, input.body);
	const previousState =
		plan.type === "unit_state" || plan.type === "realm_unit_state" ? plan.previousState : null;
	const resultingState =
		plan.type === "unit_state" || plan.type === "realm_unit_state" ? plan.resultingState : null;
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
	let reversedDecisionId: string | undefined;
	if (input.body.kind === "reverse" || input.body.kind === "restore_content_license") {
		const [reversedAction] = await tx
			.select({ decisionId: contentGovernanceAction.decisionId })
			.from(contentGovernanceAction)
			.where(
				and(
					eq(contentGovernanceAction.id, input.body.reversesActionId),
					eq(contentGovernanceAction.caseId, input.caseRow.id),
				),
			)
			.limit(1);
		if (!reversedAction) throw new ModerationReversedActionInvalid();
		if (!reversedAction.decisionId) throw new ModerationReversalUnavailable();
		reversedDecisionId = reversedAction.decisionId;
	}
	const decision = await createGovernanceDecision(tx, {
		action: `content_governance.${input.body.kind}`,
		actorProfileId: input.actorProfileId,
		authority: contentGovernanceAuthority(input.caseRow),
		targetUnitId: input.caseRow.targetUnitId,
		subject: { kind: "content_review_case", id: input.caseRow.id },
		basis:
			input.body.kind === "reverse" || input.body.kind === "restore_content_license"
				? { kind: "reversal", reversesDecisionId: reversedDecisionId! }
				: { kind: "rules", rules: input.body.rules },
	});
	const rules = decision.rules;
	const [created] = await tx
		.insert(contentGovernanceAction)
		.values({
			decisionId: decision.id,
			caseId: input.caseRow.id,
			actorProfileId: input.actorProfileId,
			kind: input.body.kind,
			previousState,
			resultingState,
			previousPostTargetingLocked,
			contentLicenseId,
			previousContentLicenseStatus,
			resultingContentLicenseStatus,
			resultingPostTargetingLocked,
			reversesActionId:
				input.body.kind === "reverse" || input.body.kind === "restore_content_license"
					? input.body.reversesActionId
					: undefined,
			idempotencyKey: input.body.idempotencyKey,
			requestFingerprint: fingerprint,
		})
		.returning(contentGovernanceActionSelection);
	if (!created) throw new Error("Content governance action insertion did not return a row");
	const noteBindings: Array<{
		postId: string;
		role: "internal_note" | "public_notice";
	}> = [];
	const createNotes = async () => {
		for (const note of input.body.notes ?? []) {
			const binding = await createGovernanceNotePost(tx, {
				actorProfileId: input.actorProfileId,
				subjectKind: "content_governance_action",
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
	});
	if (!(isPostTargetingLockPlan && plan.resultingPostTargetingLocked)) await createNotes();
	const notePostIds = noteBindings.map((binding) => binding.postId);
	const nextCaseState = "actioned" as const;
	if (input.caseRow.state !== nextCaseState)
		await tx
			.update(contentReviewCase)
			.set({ state: nextCaseState })
			.where(eq(contentReviewCase.id, input.caseRow.id));
	const publicNoticePostId = noteBindings.find(
		(binding) => binding.role === "public_notice",
	)?.postId;
	for (const recipientProfileId of target.recipientProfileIds) {
		await createNotification(tx, {
			recipientProfileId,
			actorProfileId: input.actorProfileId,
			kind: "moderation",
			subjectUnitId: target.subjectUnitId,
			payload: {
				type: "content_governance_action",
				actionId: created.id,
				actionKind: input.body.kind,
				publicNoticePostId,
			},
		});
	}
	if (!isActiveContentReviewCaseState(nextCaseState))
		for (const caseReport of caseReports) {
			await createNotification(tx, {
				recipientProfileId: caseReport.reporterProfileId,
				actorProfileId: input.actorProfileId,
				kind: "moderation",
				subjectUnitId: target.subjectUnitId,
				payload: {
					type: "report_resolution",
					reportId: caseReport.reportId,
					referralId: caseReport.referralId,
					actionId: created.id,
					actionKind: input.body.kind,
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
		action: `content_governance.${input.body.kind}`,
		governanceDecisionId: decision.id,
		target: {
			kind: input.caseRow.authority === "realm" ? "realm_unit" : "unit",
			id: input.caseRow.targetUnitId,
		},
		details: {
			contentGovernanceActionId: created.id,
			caseId: input.caseRow.id,
			realmId: input.caseRow.realmId,
			rules,
			notePostIds,
		},
	});
	const response = {
		...created,
		rules,
		notes: noteBindings,
	} satisfies ContentGovernanceActionResponse;
	return { created: response, replayed: false };
}
