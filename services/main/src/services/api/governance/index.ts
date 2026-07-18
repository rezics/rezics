import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import type { Authorization } from "../../authorization";
import { database } from "../../database";
import {
	accountEnforcement,
	auditEvent,
	capabilityGrant,
	feedback,
	moderationAction,
	moderationCase,
	post,
	profile as profileTable,
	realmUnit,
	realmUnitStatusEvent,
	realmMember,
	RealmCapabilityValues,
	unit,
	unitCollaborator,
	unitFieldLock,
} from "../../database/schema";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import type { DatabaseTransaction } from "../../database";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { FeedbackNotFound } from "../feedback/errors";
import { RealmMemberNotFound } from "../realms/errors";
import { ProfileNotFound } from "../users/errors";
import {
	AccountEnforcementParams,
	AddUnitCollaboratorBody,
	AddUnitFieldLockBody,
	CollaboratorListResponse,
	CollaboratorResponse,
	CreateAccountEnforcementBody,
	CreateGrantBody,
	CreateModerationActionBody,
	EnforcementResponse,
	FeedbackParams,
	FieldLockListResponse,
	FieldLockResponse,
	GrantListResponse,
	GrantParams,
	GrantResponse,
	ListGrantsQuery,
	ListModerationCasesQuery,
	ModerationActionResponse,
	ModerationCaseListResponse,
	ModerationCaseParams,
	ModerationCaseResponse,
	ResolveFeedbackBody,
	RevokeAccountEnforcementBody,
	UnitCollaboratorParams,
	UnitFieldLockParams,
	UnitGovernanceParams,
	UpdateModerationCaseBody,
} from "./schema";
import {
	CapabilityGrantExpiryInvalid,
	CapabilityGrantNotFound,
	CollaboratorNotFound,
	EnforcementAlreadyRevoked,
	EnforcementChanged,
	EnforcementExpiryInvalid,
	EnforcementNotFound,
	FieldLockNotFound,
	ModerationCaseNotFound,
	ModerationRealmMissing,
	ModerationReversalInvalid,
	ModerationReversedActionInvalid,
	ModerationTargetNotFound,
	ModerationTargetPathRequired,
	PlatformGrantRealmForbidden,
	RealmGrantCapabilityInvalid,
	RealmGrantRealmRequired,
	UnitOwnerRequired,
} from "./errors";

const CapabilityForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"PlatformCapabilityRequired",
]);
const UnitEditFailureResponse = toApiErrorResponse(["UnitEditForbidden"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

const caseSelection = {
	id: moderationCase.id,
	state: moderationCase.state,
	authority: moderationCase.authority,
	realmId: moderationCase.realmId,
	targetKind: moderationCase.targetKind,
	targetId: moderationCase.targetId,
	targetPath: moderationCase.targetPath,
	reporterProfileId: moderationCase.reporterProfileId,
	assignedProfileId: moderationCase.assignedProfileId,
	duplicateOfCaseId: moderationCase.duplicateOfCaseId,
	reason: moderationCase.reason,
	safeSummary: moderationCase.safeSummary,
	createdAt: moderationCase.createdAt,
	updatedAt: moderationCase.updatedAt,
};

const actionSelection = {
	id: moderationAction.id,
	caseId: moderationAction.caseId,
	actorProfileId: moderationAction.actorProfileId,
	kind: moderationAction.kind,
	resultingStatus: moderationAction.resultingStatus,
	resultingLocked: moderationAction.resultingLocked,
	reasonCode: moderationAction.reasonCode,
	reversesActionId: moderationAction.reversesActionId,
	createdAt: moderationAction.createdAt,
};

const enforcementSelection = {
	id: accountEnforcement.id,
	profileId: accountEnforcement.profileId,
	kind: accountEnforcement.kind,
	active: sql<boolean>`${accountEnforcement.revocationActionId} is null and (${accountEnforcement.expiresAt} is null or ${accountEnforcement.expiresAt} > now())`,
	startsAt: accountEnforcement.startsAt,
	expiresAt: accountEnforcement.expiresAt,
	decisionActionId: accountEnforcement.decisionActionId,
	revocationActionId: accountEnforcement.revocationActionId,
	createdAt: accountEnforcement.createdAt,
	updatedAt: accountEnforcement.updatedAt,
};

const grantSelection = {
	id: capabilityGrant.id,
	authority: capabilityGrant.authority,
	realmId: capabilityGrant.realmId,
	profileId: capabilityGrant.profileId,
	capability: capabilityGrant.capability,
	grantedByProfileId: capabilityGrant.grantedByProfileId,
	expiresAt: capabilityGrant.expiresAt,
	revokedAt: capabilityGrant.revokedAt,
	createdAt: capabilityGrant.createdAt,
	updatedAt: capabilityGrant.updatedAt,
};

type CaseRecord = typeof moderationCase.$inferSelect;
type ActionBody = typeof CreateModerationActionBody.static;

const ModerationStatusByAction: Partial<Record<ActionBody["kind"], "approved" | "removed">> = {
	approve: "approved",
	restore: "approved",
	remove: "removed",
};
const LockStateByAction: Partial<Record<ActionBody["kind"], boolean>> = {
	lock: true,
	unlock: false,
};
const MemberStateByAction: Partial<
	Record<ActionBody["kind"], "muted" | "removed" | "banned" | "active">
> = {
	mute_member: "muted",
	remove_member: "removed",
	ban_member: "banned",
	restore_member: "active",
};

async function ensureCaseAccess(
	authorization: Authorization<string>,
	row: Pick<CaseRecord, "authority" | "realmId">,
): Promise<void> {
	if (row.authority === "realm" && row.realmId) {
		await authorization.realm.ensureCapability(row.realmId, "realm.units.moderate");
		return;
	}
	await authorization.platform.ensureCapability("platform.moderate");
}

async function ensureUnitGovernanceOwner(
	authorization: Authorization<string>,
	unitId: string,
): Promise<void> {
	await authorization.unit.ensureCanEdit(unitId);
	const [owner] = await database
		.select({ profileId: unitCollaborator.profileId })
		.from(unitCollaborator)
		.where(
			and(
				eq(unitCollaborator.unitId, unitId),
				eq(unitCollaborator.profileId, authorization.profileId),
				eq(unitCollaborator.role, "owner"),
			),
		)
		.limit(1);
	if (!owner) await authorization.platform.ensureCapability("unit.edit");
}

async function recordAuditEvent(
	tx: DatabaseTransaction,
	input: {
		actorProfileId: string;
		action: string;
		decisionCode: string;
		reason: string;
		subjectKind?: string;
		subjectId?: string;
		subjectPath?: string | null;
		metadata?: Record<string, unknown>;
	},
) {
	await tx.insert(auditEvent).values(input);
}

type ModerationTargetContext = {
	recipientProfileId: string | undefined;
	subjectUnitId: string | undefined;
};

async function getModerationTargetContext(
	tx: DatabaseTransaction,
	row: CaseRecord,
): Promise<ModerationTargetContext> {
	let recipientProfileId: string | undefined;
	let subjectUnitId: string | undefined;

	if (row.targetKind === "unit" || row.targetKind === "unit_field") {
		const [target] = await tx
			.select({ id: unit.id })
			.from(unit)
			.where(eq(unit.id, row.targetId))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		subjectUnitId = target.id;
		const [owner] = await tx
			.select({ profileId: unitCollaborator.profileId })
			.from(unitCollaborator)
			.where(and(eq(unitCollaborator.unitId, target.id), eq(unitCollaborator.role, "owner")))
			.limit(1);
		recipientProfileId = owner?.profileId;
	}
	if (row.targetKind === "profile") {
		const [target] = await tx
			.select({ id: profileTable.id })
			.from(profileTable)
			.where(eq(profileTable.id, row.targetId))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		recipientProfileId = target.id;
		subjectUnitId = target.id;
	}
	if (row.targetKind === "realm_unit") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [target] = await tx
			.select({ unitId: realmUnit.unitId })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		subjectUnitId = target.unitId;
		const [owner] = await tx
			.select({ profileId: unitCollaborator.profileId })
			.from(unitCollaborator)
			.where(
				and(eq(unitCollaborator.unitId, target.unitId), eq(unitCollaborator.role, "owner")),
			)
			.limit(1);
		recipientProfileId = owner?.profileId;
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
		recipientProfileId = target.profileId;
		subjectUnitId = row.realmId;
	}
	if (row.targetKind === "feedback") {
		const [target] = await tx
			.select({
				profileId: feedback.profileId,
				subjectUnitId: feedback.subjectUnitId,
			})
			.from(feedback)
			.where(eq(feedback.id, row.targetId))
			.limit(1);
		if (!target) throw new ModerationTargetNotFound();
		recipientProfileId = target.profileId;
		subjectUnitId = target.subjectUnitId ?? undefined;
	}
	return { recipientProfileId, subjectUnitId };
}

async function applyAction(
	tx: DatabaseTransaction,
	row: CaseRecord,
	body: ActionBody,
	actorProfileId: string,
): Promise<{
	status: "approved" | "pending" | "removed" | null;
	locked: boolean | null;
}> {
	const status = body.resultingStatus ?? ModerationStatusByAction[body.kind];
	const locked = body.resultingLocked ?? LockStateByAction[body.kind];
	if (row.targetKind === "unit" || row.targetKind === "unit_field") {
		if (status)
			await tx
				.update(unit)
				.set({ moderationStatus: status })
				.where(eq(unit.id, row.targetId));
		if (locked !== undefined)
			await tx.update(post).set({ locked }).where(eq(post.id, row.targetId));
		if (body.kind === "field_lock") {
			if (!row.targetPath) throw new ModerationTargetPathRequired();
			await tx
				.insert(unitFieldLock)
				.values({
					unitId: row.targetId,
					path: row.targetPath,
					lockedByProfileId: actorProfileId,
					reason: body.reason,
				})
				.onConflictDoUpdate({
					target: [unitFieldLock.unitId, unitFieldLock.path],
					set: { lockedByProfileId: actorProfileId, reason: body.reason },
				});
		}
		if (body.kind === "field_unlock" && row.targetPath)
			await tx
				.delete(unitFieldLock)
				.where(
					and(
						eq(unitFieldLock.unitId, row.targetId),
						eq(unitFieldLock.path, row.targetPath),
					),
				);
	}
	if (row.targetKind === "realm_unit") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const [current] = await tx
			.select({ status: realmUnit.status })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)))
			.limit(1);
		if (!current) throw new ModerationTargetNotFound();
		const nextStatus = status === "approved" ? "visible" : status;
		if (nextStatus && locked !== undefined)
			await tx
				.update(realmUnit)
				.set({ status: nextStatus, locked })
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)));
		else if (nextStatus)
			await tx
				.update(realmUnit)
				.set({ status: nextStatus })
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)));
		else if (locked !== undefined)
			await tx
				.update(realmUnit)
				.set({ locked })
				.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.targetId)));
		if (nextStatus && nextStatus !== current.status)
			await tx.insert(realmUnitStatusEvent).values({
				realmId: row.realmId,
				unitId: row.targetId,
				fromStatus: current.status,
				toStatus: nextStatus,
				changedByProfileId: actorProfileId,
			});
	}
	if (row.targetKind === "realm_member") {
		if (!row.realmId) throw new ModerationRealmMissing();
		const next = MemberStateByAction[body.kind];
		if (next)
			await tx
				.update(realmMember)
				.set({ state: next })
				.where(
					and(
						eq(realmMember.realmId, row.realmId),
						eq(realmMember.profileId, row.targetId),
					),
				);
	}
	return { status: status ?? null, locked: locked ?? null };
}

export default new Elysia({ prefix: "/governance" })
	.use(session)
	.get(
		"/moderation/cases",
		async ({ authorization, query }) => {
			await ensureCaseAccess(authorization, {
				authority: query.realmId ? "realm" : "platform",
				realmId: query.realmId ?? null,
			});
			return {
				items: await database
					.select(caseSelection)
					.from(moderationCase)
					.where(
						and(
							query.realmId ? eq(moderationCase.realmId, query.realmId) : undefined,
							query.state ? eq(moderationCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(moderationCase.createdAt), desc(moderationCase.id))
					.limit(query.limit ?? 50),
			};
		},
		{
			auth: true,
			query: ListModerationCasesQuery,
			response: {
				[StatusCodes.OK]: ModerationCaseListResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
			},
			detail: { summary: "List moderation cases", tags: ["Governance"] },
		},
	)
	.get(
		"/moderation/cases/:caseId",
		async ({ authorization, params }) => {
			const [row] = await database
				.select(caseSelection)
				.from(moderationCase)
				.where(eq(moderationCase.id, params.caseId))
				.limit(1);
			if (!row) throw new ModerationCaseNotFound();
			await ensureCaseAccess(authorization, row);
			return row;
		},
		{
			auth: true,
			params: ModerationCaseParams,
			response: {
				[StatusCodes.OK]: ModerationCaseResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ModerationCaseNotFound"]),
			},
			detail: { summary: "Get moderation case", tags: ["Governance"] },
		},
	)
	.patch(
		"/moderation/cases/:caseId",
		async ({ authorization, profile, params, body }) => {
			const [current] = await database
				.select()
				.from(moderationCase)
				.where(eq(moderationCase.id, params.caseId))
				.limit(1);
			if (!current) throw new ModerationCaseNotFound();
			await ensureCaseAccess(authorization, current);
			return database.transaction(async (tx) => {
				const rows = await tx
					.update(moderationCase)
					.set({
						state: body.state,
						assignedProfileId: body.assignedProfileId,
						duplicateOfCaseId: body.duplicateOfCaseId,
						safeSummary: body.safeSummary,
						reason: body.reason,
					})
					.where(eq(moderationCase.id, params.caseId))
					.returning(caseSelection);
				const [updated] = rows;
				if (!updated) throw new ModerationCaseNotFound();
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "moderation.case.update",
					decisionCode: "allowed",
					reason: "Moderation case updated",
					subjectKind: "moderation_case",
					subjectId: params.caseId,
					metadata: { changes: body },
				});
				return updated;
			});
		},
		{
			write: true,
			params: ModerationCaseParams,
			body: UpdateModerationCaseBody,
			response: {
				[StatusCodes.OK]: ModerationCaseResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ModerationCaseNotFound"]),
			},
			detail: { summary: "Update moderation case", tags: ["Governance"] },
		},
	)
	.post(
		"/moderation/actions",
		async ({ authorization, profile, body }) => {
			if ((body.kind === "reverse") !== Boolean(body.reversesActionId))
				throw new ModerationReversalInvalid();
			if (body.idempotencyKey) {
				const [existing] = await database
					.select(actionSelection)
					.from(moderationAction)
					.where(eq(moderationAction.idempotencyKey, body.idempotencyKey))
					.limit(1);
				if (existing) return existing;
			}
			const result = await database.transaction(async (tx) => {
				const [caseRow] = await tx
					.select()
					.from(moderationCase)
					.where(eq(moderationCase.id, body.caseId))
					.limit(1);
				if (!caseRow) throw new ModerationCaseNotFound();
				await ensureCaseAccess(authorization, caseRow);
				if (body.reversesActionId) {
					const [reversed] = await tx
						.select({ caseId: moderationAction.caseId })
						.from(moderationAction)
						.where(eq(moderationAction.id, body.reversesActionId))
						.limit(1);
					if (!reversed || reversed.caseId !== caseRow.id)
						throw new ModerationReversedActionInvalid();
				}
				const target = await getModerationTargetContext(tx, caseRow);
				const outcome = await applyAction(tx, caseRow, body, profile.unitId);
				const [created] = await tx
					.insert(moderationAction)
					.values({
						caseId: caseRow.id,
						actorProfileId: profile.unitId,
						kind: body.kind,
						resultingStatus: outcome.status,
						resultingLocked: outcome.locked,
						reasonCode: body.reasonCode,
						reason: body.reason,
						publicMessage: body.publicMessage,
						reversesActionId: body.reversesActionId,
						idempotencyKey: body.idempotencyKey,
					})
					.returning(actionSelection);
				if (!created) throw new Error("Moderation action insertion did not return a row");
				await tx
					.update(moderationCase)
					.set({ state: body.kind === "escalate" ? "escalated" : "actioned" })
					.where(eq(moderationCase.id, caseRow.id));
				const notificationId = target.recipientProfileId
					? await createNotification(tx, {
							recipientProfileId: target.recipientProfileId,
							actorProfileId: profile.unitId,
							kind: "moderation",
							subjectUnitId: target.subjectUnitId,
							payload: { action: body.kind, message: body.publicMessage },
						})
					: undefined;
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: `moderation.${body.kind}`,
					decisionCode: body.reasonCode,
					reason: body.reason ?? body.reasonCode,
					subjectKind: caseRow.targetKind,
					subjectId: caseRow.targetId,
					subjectPath: caseRow.targetPath,
					metadata: {
						moderationActionId: created.id,
						caseId: caseRow.id,
						realmId: caseRow.realmId,
					},
				});
				return { created, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.created;
		},
		{
			write: true,
			body: CreateModerationActionBody,
			response: {
				[StatusCodes.OK]: ModerationActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"ModerationReversalInvalid",
					"ModerationReversedActionInvalid",
					"ModerationRealmMissing",
					"ModerationTargetPathRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ModerationCaseNotFound",
					"ModerationTargetNotFound",
				]),
			},
			detail: { summary: "Apply moderation action", tags: ["Governance"] },
		},
	)
	.patch(
		"/feedback/:feedbackId/resolve",
		async ({ authorization, profile, params, body }) => {
			const [caseRow] = await database
				.select()
				.from(moderationCase)
				.where(
					and(
						eq(moderationCase.targetKind, "feedback"),
						eq(moderationCase.targetId, params.feedbackId),
					),
				)
				.orderBy(desc(moderationCase.createdAt))
				.limit(1);
			await ensureCaseAccess(
				authorization,
				caseRow ?? { authority: "platform", realmId: null },
			);
			const result = await database.transaction(async (tx) => {
				const [updated] = await tx
					.update(feedback)
					.set({
						resolution: body.resolution,
						resolvedByProfileId: profile.unitId,
						resolvedAt: new Date(),
					})
					.where(eq(feedback.id, params.feedbackId))
					.returning({ id: feedback.id, profileId: feedback.profileId });
				if (!updated) throw new FeedbackNotFound();
				if (caseRow)
					await tx
						.update(moderationCase)
						.set({ state: "resolved" })
						.where(eq(moderationCase.id, caseRow.id));
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "feedback.resolve",
					decisionCode: "allowed",
					reason: body.resolution,
					subjectKind: "feedback",
					subjectId: updated.id,
				});
				const notificationId = await createNotification(tx, {
					recipientProfileId: updated.profileId,
					actorProfileId: profile.unitId,
					kind: "moderation",
					payload: { feedbackId: updated.id, resolution: body.resolution },
				});
				return notificationId;
			});
			await deliverNotificationEmail(result);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: FeedbackParams,
			body: ResolveFeedbackBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["FeedbackNotFound"]),
			},
			detail: {
				summary: "Resolve feedback",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	)
	.post(
		"/moderation/enforcements",
		async ({ authorization, profile, body }) => {
			await authorization.platform.ensureCapability("platform.moderate");
			const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
			if (expiresAt && expiresAt <= new Date()) throw new EnforcementExpiryInvalid();
			const result = await database.transaction(async (tx) => {
				const [target] = await tx
					.select({ id: profileTable.id })
					.from(profileTable)
					.where(eq(profileTable.id, body.profileId))
					.limit(1);
				if (!target) throw new ProfileNotFound();
				const [caseRow] = await tx
					.insert(moderationCase)
					.values({
						targetKind: "profile",
						targetId: target.id,
						reason: body.reason,
					})
					.returning({ id: moderationCase.id });
				if (!caseRow) throw new Error("Moderation case insertion did not return a row");
				const [action] = await tx
					.insert(moderationAction)
					.values({
						caseId: caseRow.id,
						actorProfileId: profile.unitId,
						kind: body.kind,
						reasonCode: body.decisionCode,
						reason: body.reason,
						publicMessage: body.publicMessage,
					})
					.returning({ id: moderationAction.id });
				if (!action) throw new Error("Moderation action insertion did not return a row");
				const [created] = await tx
					.insert(accountEnforcement)
					.values({
						profileId: target.id,
						kind: body.kind,
						expiresAt,
						decisionActionId: action.id,
					})
					.returning(enforcementSelection);
				if (!created) throw new Error("Enforcement insertion did not return a row");
				await tx
					.update(moderationCase)
					.set({ state: "actioned" })
					.where(eq(moderationCase.id, caseRow.id));
				const notificationId = await createNotification(tx, {
					recipientProfileId: target.id,
					actorProfileId: profile.unitId,
					kind: "moderation",
					subjectUnitId: target.id,
					payload: { kind: body.kind, message: body.publicMessage },
				});
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "account.enforcement.create",
					decisionCode: body.decisionCode,
					reason: body.reason,
					subjectKind: "profile",
					subjectId: target.id,
					metadata: { enforcementId: created.id, kind: body.kind },
				});
				return { created, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.created;
		},
		{
			write: true,
			body: CreateAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["EnforcementExpiryInvalid"]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
			},
			detail: { summary: "Create account enforcement", tags: ["Governance"] },
		},
	)
	.post(
		"/moderation/enforcements/:enforcementId/revoke",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.moderate");
			return database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						id: accountEnforcement.id,
						profileId: accountEnforcement.profileId,
						decisionActionId: accountEnforcement.decisionActionId,
						caseId: moderationAction.caseId,
						revocationActionId: accountEnforcement.revocationActionId,
					})
					.from(accountEnforcement)
					.innerJoin(
						moderationAction,
						eq(moderationAction.id, accountEnforcement.decisionActionId),
					)
					.where(eq(accountEnforcement.id, params.enforcementId))
					.limit(1);
				if (!current) throw new EnforcementNotFound();
				if (current.revocationActionId) throw new EnforcementAlreadyRevoked();
				const [action] = await tx
					.insert(moderationAction)
					.values({
						caseId: current.caseId,
						actorProfileId: profile.unitId,
						kind: "revoke_enforcement",
						reasonCode: "revoked",
						reason: body.reason,
						reversesActionId: current.decisionActionId,
					})
					.returning({ id: moderationAction.id });
				if (!action) throw new Error("Moderation action insertion did not return a row");
				const [updated] = await tx
					.update(accountEnforcement)
					.set({ revocationActionId: action.id })
					.where(
						and(
							eq(accountEnforcement.id, current.id),
							isNull(accountEnforcement.revocationActionId),
						),
					)
					.returning(enforcementSelection);
				if (!updated) throw new EnforcementChanged();
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "account.enforcement.revoke",
					decisionCode: "revoked",
					reason: body.reason,
					subjectKind: "profile",
					subjectId: current.profileId,
					metadata: { enforcementId: current.id },
				});
				return updated;
			});
		},
		{
			write: true,
			params: AccountEnforcementParams,
			body: RevokeAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EnforcementNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"EnforcementAlreadyRevoked",
					"EnforcementChanged",
				]),
			},
			detail: { summary: "Revoke account enforcement", tags: ["Governance"] },
		},
	)
	.get(
		"/grants",
		async ({ authorization, query }) => {
			if (query.authority === "platform") {
				if (query.realmId) throw new PlatformGrantRealmForbidden();
				await authorization.platform.ensureCapability("platform.grants.manage");
			} else {
				if (!query.realmId) throw new RealmGrantRealmRequired();
				await authorization.realm.ensureCapability(query.realmId, "realm.members.manage");
			}
			return {
				items: await database
					.select(grantSelection)
					.from(capabilityGrant)
					.where(
						and(
							eq(capabilityGrant.authority, query.authority),
							query.realmId
								? eq(capabilityGrant.realmId, query.realmId)
								: isNull(capabilityGrant.realmId),
						),
					)
					.orderBy(desc(capabilityGrant.createdAt), desc(capabilityGrant.id)),
			};
		},
		{
			auth: true,
			query: ListGrantsQuery,
			response: {
				[StatusCodes.OK]: GrantListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"PlatformGrantRealmForbidden",
					"RealmGrantRealmRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
			},
			detail: { summary: "List capability grants", tags: ["Governance"] },
		},
	)
	.post(
		"/grants",
		async ({ authorization, profile, body }) => {
			let realmId: string | undefined;
			if (body.authority === "platform") {
				if (body.realmId) throw new PlatformGrantRealmForbidden();
				await authorization.platform.ensureCapability("platform.grants.manage");
			} else {
				if (!body.realmId) throw new RealmGrantRealmRequired();
				realmId = body.realmId;
				await authorization.realm.ensureCapability(realmId, "realm.members.manage");
				if (!RealmCapabilityValues.some((capability) => capability === body.capability))
					throw new RealmGrantCapabilityInvalid();
				const [member] = await database
					.select({ profileId: realmMember.profileId })
					.from(realmMember)
					.where(
						and(
							eq(realmMember.realmId, realmId),
							eq(realmMember.profileId, body.profileId),
							eq(realmMember.state, "active"),
						),
					)
					.limit(1);
				if (!member) throw new RealmMemberNotFound(true);
			}
			const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
			if (expiresAt && expiresAt <= new Date()) throw new CapabilityGrantExpiryInvalid();
			return database.transaction(async (tx) => {
				const [created] = await tx
					.insert(capabilityGrant)
					.values({
						authority: body.authority,
						realmId,
						profileId: body.profileId,
						capability: body.capability,
						grantedByProfileId: profile.unitId,
						expiresAt,
					})
					.onConflictDoUpdate({
						target: [
							capabilityGrant.authority,
							capabilityGrant.realmId,
							capabilityGrant.profileId,
							capabilityGrant.capability,
						],
						set: {
							grantedByProfileId: profile.unitId,
							expiresAt,
							revokedAt: null,
							revokedByProfileId: null,
						},
					})
					.returning(grantSelection);
				if (!created) throw new Error("Capability grant insertion did not return a row");
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "capability_grant.upsert",
					decisionCode: "allowed",
					reason: `Granted ${body.capability}`,
					subjectKind: "profile",
					subjectId: body.profileId,
					metadata: {
						authority: body.authority,
						realmId,
						capability: body.capability,
					},
				});
				return created;
			});
		},
		{
			write: true,
			body: CreateGrantBody,
			response: {
				[StatusCodes.OK]: GrantResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"PlatformGrantRealmForbidden",
					"RealmGrantRealmRequired",
					"RealmGrantCapabilityInvalid",
					"CapabilityGrantExpiryInvalid",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmMemberNotFound"]),
			},
			detail: { summary: "Create capability grant", tags: ["Governance"] },
		},
	)
	.delete(
		"/grants/:grantId",
		async ({ authorization, profile, params }) => {
			const [current] = await database
				.select()
				.from(capabilityGrant)
				.where(eq(capabilityGrant.id, params.grantId))
				.limit(1);
			if (!current || current.revokedAt) throw new CapabilityGrantNotFound();
			if (current.authority === "platform") {
				await authorization.platform.ensureCapability("platform.grants.manage");
			} else {
				if (!current.realmId)
					throw new Error("Realm capability grant is missing its Realm");
				await authorization.realm.ensureCapability(current.realmId, "realm.members.manage");
			}
			await database.transaction(async (tx) => {
				const [updated] = await tx
					.update(capabilityGrant)
					.set({ revokedAt: new Date(), revokedByProfileId: profile.unitId })
					.where(
						and(eq(capabilityGrant.id, current.id), isNull(capabilityGrant.revokedAt)),
					)
					.returning({
						profileId: capabilityGrant.profileId,
						capability: capabilityGrant.capability,
					});
				if (!updated) throw new CapabilityGrantNotFound();
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "capability_grant.revoke",
					decisionCode: "allowed",
					reason: `Revoked ${updated.capability}`,
					subjectKind: "profile",
					subjectId: updated.profileId,
					metadata: { grantId: current.id },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: GrantParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["CapabilityGrantNotFound"]),
			},
			detail: {
				summary: "Revoke capability grant",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/unit/:unitId/collaborators",
		async ({ authorization, params }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			return {
				items: await database
					.select()
					.from(unitCollaborator)
					.where(eq(unitCollaborator.unitId, params.unitId))
					.orderBy(
						unitCollaborator.role,
						unitCollaborator.createdAt,
						unitCollaborator.profileId,
					),
			};
		},
		{
			auth: true,
			params: UnitGovernanceParams,
			response: {
				[StatusCodes.OK]: CollaboratorListResponse,
				[StatusCodes.FORBIDDEN]: UnitEditFailureResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit collaborators", tags: ["Governance"] },
		},
	)
	.put(
		"/unit/:unitId/collaborators",
		async ({ authorization, profile, params, body }) => {
			await ensureUnitGovernanceOwner(authorization, params.unitId);
			return database.transaction(async (tx) => {
				const [created] = await tx
					.insert(unitCollaborator)
					.values({
						unitId: params.unitId,
						profileId: body.profileId,
						role: body.role,
						addedByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [unitCollaborator.unitId, unitCollaborator.profileId],
						set: { role: body.role, addedByProfileId: profile.unitId },
					})
					.returning();
				if (!created) throw new Error("Collaborator upsert did not return a row");
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "unit.collaborator.upsert",
					decisionCode: "allowed",
					reason: `Set collaborator role to ${body.role}`,
					subjectKind: "unit",
					subjectId: params.unitId,
					metadata: { profileId: body.profileId },
				});
				return created;
			});
		},
		{
			write: true,
			params: UnitGovernanceParams,
			body: AddUnitCollaboratorBody,
			response: {
				[StatusCodes.OK]: CollaboratorResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitEditForbidden",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Add or update Unit collaborator", tags: ["Governance"] },
		},
	)
	.delete(
		"/unit/:unitId/collaborators/:profileId",
		async ({ authorization, profile, params }) => {
			await ensureUnitGovernanceOwner(authorization, params.unitId);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`collaborators:${params.unitId}`}::text, 0))`,
				);
				const [target] = await tx
					.select({ role: unitCollaborator.role })
					.from(unitCollaborator)
					.where(
						and(
							eq(unitCollaborator.unitId, params.unitId),
							eq(unitCollaborator.profileId, params.profileId),
						),
					)
					.limit(1);
				if (!target) throw new CollaboratorNotFound();
				if (target.role === "owner") {
					const owners = await tx
						.select({ profileId: unitCollaborator.profileId })
						.from(unitCollaborator)
						.where(
							and(
								eq(unitCollaborator.unitId, params.unitId),
								eq(unitCollaborator.role, "owner"),
							),
						);
					if (owners.length <= 1) throw new UnitOwnerRequired();
				}
				await tx
					.delete(unitCollaborator)
					.where(
						and(
							eq(unitCollaborator.unitId, params.unitId),
							eq(unitCollaborator.profileId, params.profileId),
						),
					);
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "unit.collaborator.delete",
					decisionCode: "allowed",
					reason: "Collaborator removed",
					subjectKind: "unit",
					subjectId: params.unitId,
					metadata: { profileId: params.profileId },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: UnitCollaboratorParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitEditForbidden",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"CollaboratorNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitOwnerRequired"]),
			},
			detail: {
				summary: "Remove Unit collaborator",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/unit/:unitId/field-locks",
		async ({ authorization, params }) => {
			await authorization.unit.ensureCanEdit(params.unitId);
			return {
				items: await database
					.select()
					.from(unitFieldLock)
					.where(eq(unitFieldLock.unitId, params.unitId))
					.orderBy(unitFieldLock.path, unitFieldLock.id),
			};
		},
		{
			auth: true,
			params: UnitGovernanceParams,
			response: {
				[StatusCodes.OK]: FieldLockListResponse,
				[StatusCodes.FORBIDDEN]: UnitEditFailureResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List Unit field locks", tags: ["Governance"] },
		},
	)
	.post(
		"/unit/:unitId/field-locks",
		async ({ authorization, profile, params, body }) => {
			await ensureUnitGovernanceOwner(authorization, params.unitId);
			return database.transaction(async (tx) => {
				const [created] = await tx
					.insert(unitFieldLock)
					.values({
						unitId: params.unitId,
						path: body.path,
						lockedByProfileId: profile.unitId,
						reason: body.reason,
					})
					.onConflictDoUpdate({
						target: [unitFieldLock.unitId, unitFieldLock.path],
						set: { lockedByProfileId: profile.unitId, reason: body.reason },
					})
					.returning();
				if (!created) throw new Error("Field lock upsert did not return a row");
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "unit.field_lock.upsert",
					decisionCode: "allowed",
					reason: body.reason ?? "Unit field locked",
					subjectKind: "unit",
					subjectId: params.unitId,
					subjectPath: body.path,
				});
				return created;
			});
		},
		{
			write: true,
			params: UnitGovernanceParams,
			body: AddUnitFieldLockBody,
			response: {
				[StatusCodes.OK]: FieldLockResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitEditForbidden",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Lock Unit field", tags: ["Governance"] },
		},
	)
	.delete(
		"/unit/:unitId/field-locks/:lockId",
		async ({ authorization, profile, params }) => {
			await ensureUnitGovernanceOwner(authorization, params.unitId);
			await database.transaction(async (tx) => {
				const [deleted] = await tx
					.delete(unitFieldLock)
					.where(
						and(
							eq(unitFieldLock.id, params.lockId),
							eq(unitFieldLock.unitId, params.unitId),
						),
					)
					.returning({ path: unitFieldLock.path });
				if (!deleted) throw new FieldLockNotFound();
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "unit.field_lock.delete",
					decisionCode: "allowed",
					reason: "Unit field unlocked",
					subjectKind: "unit",
					subjectId: params.unitId,
					subjectPath: deleted.path,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			write: true,
			params: UnitFieldLockParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitEditForbidden",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "FieldLockNotFound"]),
			},
			detail: {
				summary: "Unlock Unit field",
				tags: ["Governance"],
				responses: NoContentResponse,
			},
		},
	);
