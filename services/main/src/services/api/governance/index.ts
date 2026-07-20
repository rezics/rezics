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
	profile as profileTable,
	realmMember,
	RealmCapabilityValues,
	unitLocalization,
} from "../../database/schema";
import {
	createGovernanceNotePost,
	getGovernanceNote,
	listGovernanceNotes,
} from "../../governance/note-service";
import { createNotification, deliverNotificationEmail } from "../../notifications/service";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { makePrimaryUnitLocalization } from "../../units/localization";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { FeedbackAlreadyResolved, FeedbackNotFound } from "../feedback/errors";
import { RealmMemberNotFound } from "../realms/errors";
import { ProfileNotFound } from "../users/errors";
import {
	AccountEnforcementParams,
	CreateAccountEnforcementBody,
	CreateGrantBody,
	CreateModerationActionBody,
	EnforcementResponse,
	FeedbackParams,
	GrantListResponse,
	GrantParams,
	GrantResponse,
	GovernanceNoteParams,
	GovernanceNoteResponse,
	ListGrantsQuery,
	ListModerationCasesQuery,
	ModerationActionResponse,
	ModerationCaseListResponse,
	ModerationCaseParams,
	ModerationCaseResponse,
	ResolveFeedbackBody,
	RevokeAccountEnforcementBody,
	UpdateModerationCaseBody,
	UpdateGovernanceNoteBody,
} from "./schema";
import {
	CapabilityGrantExpiryInvalid,
	CapabilityGrantNotFound,
	EnforcementAlreadyRevoked,
	EnforcementChanged,
	EnforcementExpiryInvalid,
	EnforcementNotFound,
	GovernanceNoteNotFound,
	ModerationCaseNotFound,
	ModerationNoteRoleDuplicate,
	PlatformGrantRealmForbidden,
	RealmGrantCapabilityInvalid,
	RealmGrantRealmRequired,
} from "./errors";
import unitAccessRoutes from "./unit-access";
import unitAccessInvitationRoutes from "./unit-access-invitations";
import {
	executeAuthorizedModerationAction,
	loadModerationCaseForAction,
} from "./moderation-service";

const CapabilityForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"PlatformCapabilityRequired",
]);

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
	createdAt: moderationCase.createdAt,
	updatedAt: moderationCase.updatedAt,
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
type PresentableCase = Pick<CaseRecord, "id" | "targetKind" | "targetId">;

async function presentModerationCases<T extends PresentableCase>(
	tx: DatabaseTransaction,
	rows: readonly T[],
) {
	const caseNotes = await listGovernanceNotes(tx, {
		subjectKind: "moderation_case",
		subjectIds: rows.map((row) => row.id),
		roles: ["internal_note"],
	});
	const feedbackIds = rows
		.filter((row) => row.targetKind === "feedback")
		.map((row) => row.targetId);
	const feedbackNotes = await listGovernanceNotes(tx, {
		subjectKind: "feedback",
		subjectIds: feedbackIds,
		roles: ["evidence", "public_notice"],
	});
	return rows.map((row) => ({
		...row,
		notes: [...caseNotes, ...feedbackNotes]
			.filter(
				(note) =>
					(note.subjectId === row.id && note.role === "internal_note") ||
					(row.targetKind === "feedback" && note.subjectId === row.targetId),
			)
			.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
			.map(({ subjectId: _subjectId, ...note }) => note),
	}));
}

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

async function recordAuditEvent(
	tx: DatabaseTransaction,
	input: {
		actorProfileId: string;
		action: string;
		decisionCode: string;
		subjectKind?: string;
		subjectId?: string;
		subjectPath?: string | null;
		metadata?: Record<string, unknown>;
	},
) {
	await tx.insert(auditEvent).values(input);
}

export default new Elysia({ prefix: "/governance" })
	.use(session)
	.use(unitAccessRoutes)
	.use(unitAccessInvitationRoutes)
	.get(
		"/notes/:postId",
		async ({ params, authorization }) => {
			await authorization.unit.ensureCanRead(
				params.postId,
				() => new GovernanceNoteNotFound(),
			);
			const note = await database.transaction((tx) => getGovernanceNote(tx, params.postId));
			if (!note) throw new GovernanceNoteNotFound();
			const { subjectId: _subjectId, ...response } = note;
			return response;
		},
		{
			access: "session-only",
			params: GovernanceNoteParams,
			response: {
				[StatusCodes.OK]: GovernanceNoteResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["GovernanceNoteNotFound"]),
			},
			detail: { summary: "Get governance note", tags: ["Governance"] },
		},
	)
	.patch(
		"/notes/:postId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanUpdate(params.postId, [["localizations"]]);
			const note = await database.transaction(async (tx) => {
				if (!(await getGovernanceNote(tx, params.postId)))
					throw new GovernanceNoteNotFound();
				await tx
					.insert(unitLocalization)
					.values({
						unitId: params.postId,
						language: body.language,
						content: body.content,
						contentStatus: "published",
					})
					.onConflictDoUpdate({
						target: [unitLocalization.unitId, unitLocalization.language],
						set: {
							content: body.content,
							contentStatus: "published",
							updatedAt: new Date(),
						},
					});
				await makePrimaryUnitLocalization(tx, params.postId, body.language);
				await recordUnitRevision(tx, {
					unitId: params.postId,
					actorProfileId: profile.unitId,
					event: "update",
					baseRevisionId: body.baseRevisionId,
					message: body.editSummary,
					minor: body.minor,
				});
				const updated = await getGovernanceNote(tx, params.postId);
				if (!updated) throw new GovernanceNoteNotFound();
				return updated;
			});
			const { subjectId: _subjectId, ...response } = note;
			return response;
		},
		{
			access: "contribute:unit:update",
			params: GovernanceNoteParams,
			body: UpdateGovernanceNoteBody,
			response: {
				[StatusCodes.OK]: GovernanceNoteResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"UnitProtected",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"GovernanceNoteNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
			},
			detail: { summary: "Update governance note", tags: ["Governance"] },
		},
	)
	.get(
		"/moderation/cases",
		async ({ authorization, query }) => {
			await ensureCaseAccess(authorization, {
				authority: query.realmId ? "realm" : "platform",
				realmId: query.realmId ?? null,
			});
			return database.transaction(async (tx) => {
				const rows = await tx
					.select(caseSelection)
					.from(moderationCase)
					.where(
						and(
							eq(moderationCase.authority, query.realmId ? "realm" : "platform"),
							query.realmId ? eq(moderationCase.realmId, query.realmId) : undefined,
							query.state ? eq(moderationCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(moderationCase.createdAt), desc(moderationCase.id))
					.limit(query.limit ?? 50);
				return { items: await presentModerationCases(tx, rows) };
			});
		},
		{
			access: "session-only",
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
			return database.transaction(async (tx) => {
				const [row] = await tx
					.select(caseSelection)
					.from(moderationCase)
					.where(eq(moderationCase.id, params.caseId))
					.limit(1);
				if (!row) throw new ModerationCaseNotFound();
				await ensureCaseAccess(authorization, row);
				const [presented] = await presentModerationCases(tx, [row]);
				if (!presented) throw new ModerationCaseNotFound();
				return presented;
			});
		},
		{
			access: "session-only",
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
				const { internalNote, ...changes } = body;
				const rows = await tx
					.update(moderationCase)
					.set({ ...changes, updatedAt: new Date() })
					.where(eq(moderationCase.id, params.caseId))
					.returning(caseSelection);
				const [updated] = rows;
				if (!updated) throw new ModerationCaseNotFound();
				const note = internalNote
					? await createGovernanceNotePost(tx, {
							actorProfileId: profile.unitId,
							subjectKind: "moderation_case",
							subjectId: current.id,
							subjectUnitId:
								current.targetKind === "feedback" ? undefined : current.targetId,
							realmId: current.realmId,
							note: { role: "internal_note", ...internalNote },
						})
					: undefined;
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "moderation.case.update",
					decisionCode: "allowed",
					subjectKind: "moderation_case",
					subjectId: params.caseId,
					metadata: { changes, internalNotePostId: note?.postId },
				});
				const [presented] = await presentModerationCases(tx, [updated]);
				if (!presented) throw new ModerationCaseNotFound();
				return presented;
			});
		},
		{
			access: "session-only",
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
			const result = await database.transaction(async (tx) => {
				const caseRow = await loadModerationCaseForAction(tx, body.caseId);
				if (!caseRow) throw new ModerationCaseNotFound();
				await ensureCaseAccess(authorization, caseRow);
				return executeAuthorizedModerationAction(tx, {
					caseRow,
					actorProfileId: profile.unitId,
					body,
				});
			});
			await Promise.all(result.notificationIds.map(deliverNotificationEmail));
			return result.created;
		},
		{
			access: "session-only",
			body: CreateModerationActionBody,
			response: {
				[StatusCodes.OK]: ModerationActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"ModerationReversedActionInvalid",
					"ModerationActionIncompatible",
					"ModerationNoteRoleDuplicate",
					"ModerationRealmMissing",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ModerationCaseNotFound",
					"ModerationTargetNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"ModerationTransitionInvalid",
					"ModerationActionNoEffect",
					"ModerationReversalUnavailable",
					"ModerationIdempotencyConflict",
					"PostTargetingLocked",
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
				const [current] = await tx
					.select({
						id: feedback.id,
						profileId: feedback.profileId,
						subjectUnitId: feedback.subjectUnitId,
						resolvedAt: feedback.resolvedAt,
					})
					.from(feedback)
					.where(eq(feedback.id, params.feedbackId))
					.for("update")
					.limit(1);
				if (!current) throw new FeedbackNotFound();
				if (current.resolvedAt) throw new FeedbackAlreadyResolved();
				const [updated] = await tx
					.update(feedback)
					.set({
						resolutionCode: body.resolutionCode,
						resolvedByProfileId: profile.unitId,
						resolvedAt: new Date(),
					})
					.where(and(eq(feedback.id, params.feedbackId), isNull(feedback.resolvedAt)))
					.returning({ id: feedback.id, profileId: feedback.profileId });
				if (!updated) throw new FeedbackAlreadyResolved();
				const publicNotice = body.publicNotice
					? await createGovernanceNotePost(tx, {
							actorProfileId: profile.unitId,
							subjectKind: "feedback",
							subjectId: updated.id,
							subjectUnitId: current.subjectUnitId ?? undefined,
							realmId: caseRow?.realmId,
							publicRecipientProfileIds: [updated.profileId],
							note: { role: "public_notice", ...body.publicNotice },
						})
					: undefined;
				if (caseRow)
					await tx
						.update(moderationCase)
						.set({ state: "resolved" })
						.where(eq(moderationCase.id, caseRow.id));
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "feedback.resolve",
					decisionCode: body.resolutionCode,
					subjectKind: "feedback",
					subjectId: updated.id,
					metadata: { publicNoticePostId: publicNotice?.postId },
				});
				const notificationId = await createNotification(tx, {
					recipientProfileId: updated.profileId,
					actorProfileId: profile.unitId,
					kind: "moderation",
					payload: {
						type: "feedback_resolution",
						feedbackId: updated.id,
						resolutionCode: body.resolutionCode,
						publicNoticePostId: publicNotice?.postId,
					},
				});
				return notificationId;
			});
			await deliverNotificationEmail(result);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: FeedbackParams,
			body: ResolveFeedbackBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["FeedbackNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["FeedbackAlreadyResolved"]),
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
			if (new Set(body.notes?.map((note) => note.role)).size !== (body.notes?.length ?? 0))
				throw new ModerationNoteRoleDuplicate();
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
					})
					.returning({ id: moderationCase.id });
				if (!caseRow) throw new Error("Moderation case insertion did not return a row");
				const [action] = await tx
					.insert(moderationAction)
					.values({
						caseId: caseRow.id,
						actorProfileId: profile.unitId,
						kind: body.kind,
						reasonCode: body.reasonCode,
					})
					.returning({ id: moderationAction.id });
				if (!action) throw new Error("Moderation action insertion did not return a row");
				const notePostIds: string[] = [];
				let publicNoticePostId: string | undefined;
				for (const note of body.notes ?? []) {
					const createdNote = await createGovernanceNotePost(tx, {
						actorProfileId: profile.unitId,
						subjectKind: "moderation_action",
						subjectId: action.id,
						subjectUnitId: target.id,
						publicRecipientProfileIds: [target.id],
						note,
					});
					notePostIds.push(createdNote.postId);
					if (note.role === "public_notice") publicNoticePostId = createdNote.postId;
				}
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
					payload: {
						type: "moderation_action",
						actionId: action.id,
						actionKind: body.kind,
						reasonCode: body.reasonCode,
						publicNoticePostId,
					},
				});
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "account.enforcement.create",
					decisionCode: body.reasonCode,
					subjectKind: "profile",
					subjectId: target.id,
					metadata: { enforcementId: created.id, kind: body.kind, notePostIds },
				});
				return { created, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.created;
		},
		{
			access: "session-only",
			body: CreateAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"EnforcementExpiryInvalid",
					"ModerationNoteRoleDuplicate",
				]),
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
			if (new Set(body.notes?.map((note) => note.role)).size !== (body.notes?.length ?? 0))
				throw new ModerationNoteRoleDuplicate();
			const result = await database.transaction(async (tx) => {
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
						reasonCode: body.reasonCode,
						reversesActionId: current.decisionActionId,
					})
					.returning({ id: moderationAction.id });
				if (!action) throw new Error("Moderation action insertion did not return a row");
				const notePostIds: string[] = [];
				let publicNoticePostId: string | undefined;
				for (const note of body.notes ?? []) {
					const createdNote = await createGovernanceNotePost(tx, {
						actorProfileId: profile.unitId,
						subjectKind: "moderation_action",
						subjectId: action.id,
						subjectUnitId: current.profileId,
						publicRecipientProfileIds: [current.profileId],
						note,
					});
					notePostIds.push(createdNote.postId);
					if (note.role === "public_notice") publicNoticePostId = createdNote.postId;
				}
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
					decisionCode: body.reasonCode,
					subjectKind: "profile",
					subjectId: current.profileId,
					metadata: { enforcementId: current.id, notePostIds },
				});
				const notificationId = await createNotification(tx, {
					recipientProfileId: current.profileId,
					actorProfileId: profile.unitId,
					kind: "moderation",
					subjectUnitId: current.profileId,
					payload: {
						type: "moderation_action",
						actionId: action.id,
						actionKind: "revoke_enforcement",
						reasonCode: body.reasonCode,
						publicNoticePostId,
					},
				});
				return { updated, notificationId };
			});
			await deliverNotificationEmail(result.notificationId);
			return result.updated;
		},
		{
			access: "session-only",
			params: AccountEnforcementParams,
			body: RevokeAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ModerationNoteRoleDuplicate"]),
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
			access: "session-only",
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
			access: "session-only",
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
					subjectKind: "profile",
					subjectId: updated.profileId,
					metadata: { grantId: current.id },
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
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
	);
