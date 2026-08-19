import { StatusCodes } from "http-status-codes";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Elysia from "elysia";
import { OfficialRealmUnitIds } from "@rezics/slug";

import session from "../../auth/session";
import { recordAuditEvent as appendAuditEvent } from "../../audit";
import type { Authorization } from "../../authorization";
import { database } from "../../database";
import {
	accountEnforcement,
	accountEnforcementAction,
	contentReviewCase,
	profile as profileTable,
	realm,
	realmRule,
	realmRuleRevision,
	unit,
	unitLocalization,
} from "../../database/schema";
import {
	createGovernanceDecision,
	resolveGovernanceRuleSourceRealmIds,
	type GovernanceAuthority,
} from "../../governance/decision-service";
import {
	createGovernanceNotePost,
	getGovernanceNote,
	listGovernanceNotes,
} from "../../governance/note-service";
import { createNotification } from "../../notifications/service";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import { toApiErrorResponse } from "../schema/response";
import { ValidationError } from "../errors";
import { ProfileNotFound } from "../users/errors";
import {
	AccountEnforcementParams,
	ContentGovernanceActionResponse,
	ContentReviewCaseListResponse,
	ContentReviewCaseParams,
	ContentReviewCaseResponse,
	CreateContentGovernanceActionBody,
	CreateAccountEnforcementBody,
	EnforcementResponse,
	GovernanceNoteParams,
	GovernanceNoteResponse,
	GovernanceRuleSourcesQuery,
	GovernanceRuleSourcesResponse,
	ListContentReviewCasesQuery,
	RevokeAccountEnforcementBody,
	UpdateContentReviewCaseBody,
	UpdateGovernanceNoteBody,
} from "./schema";
import {
	EnforcementAlreadyRevoked,
	EnforcementChanged,
	EnforcementExpiryInvalid,
	EnforcementNotFound,
	GovernanceReversalUnavailable,
	GovernanceNoteNotFound,
	ContentReviewCaseNotFound as ModerationCaseNotFound,
	GovernanceNoteRoleDuplicate as ModerationNoteRoleDuplicate,
} from "./errors";
import unitAccessRoutes from "./unit-access";
import unitAccessInvitationRoutes from "./unit-access-invitations";
import unitLifecycleRoutes from "./unit-lifecycle";
import unitMergeRoutes from "./unit-merges";
import ownershipClaimRoutes from "./ownership-claims";
import {
	executeAuthorizedContentGovernanceAction,
	loadContentReviewCaseForAction,
} from "./content-governance-service";
import { isLicenseModerationCommand } from "./content-governance-contract";

const CapabilityForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"PlatformCapabilityRequired",
]);

const caseSelection = {
	id: contentReviewCase.id,
	state: contentReviewCase.state,
	authority: contentReviewCase.authority,
	realmId: contentReviewCase.realmId,
	targetUnitId: contentReviewCase.targetUnitId,
	assignedProfileId: contentReviewCase.assignedProfileId,
	duplicateOfCaseId: contentReviewCase.duplicateOfCaseId,
	createdAt: contentReviewCase.createdAt,
	updatedAt: contentReviewCase.updatedAt,
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

type LocalizationLanguages = Parameters<typeof resolvedUnitLocalizationLanguage>[1];

async function loadGovernanceRuleSource(
	tx: DatabaseTransaction,
	realmId: string,
	scope: "platform" | "realm" | "local",
	localizationLanguages: LocalizationLanguages,
) {
	const [[source], [revision]] = await Promise.all([
		tx
			.select({
				id: realm.id,
				language: resolvedUnitLocalizationLanguage(realm.id, localizationLanguages),
				title: resolvedUnitLocalizationTitle(realm.id, localizationLanguages),
			})
			.from(realm)
			.innerJoin(unit, and(eq(unit.id, realm.id), eq(unit.kind, "realm"), isNull(unit.deletedAt)))
			.where(eq(realm.id, realmId))
			.limit(1),
		tx
			.select({ id: realmRuleRevision.id })
			.from(realmRuleRevision)
			.where(eq(realmRuleRevision.realmId, realmId))
			.orderBy(desc(realmRuleRevision.version))
			.limit(1),
	]);
	if (!source?.language || !revision) return undefined;
	const rows = await tx
		.select({
			id: realmRule.id,
			language: resolvedUnitLocalizationLanguage(realmRule.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(realmRule.id, localizationLanguages),
		})
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.orderBy(realmRule.position, realmRule.id)
		.limit(100);
	const rules = rows.map((rule) => {
		if (!rule.language || !rule.title)
			throw new Error(`Governance Rule ${rule.id} has no localization`);
		return { id: rule.id, language: rule.language, title: rule.title };
	});
	if (!rules.length) return undefined;
	return { ...source, language: source.language, scope, revisionId: revision.id, rules };
}

function governanceRuleSourceAuthority(
	query: typeof GovernanceRuleSourcesQuery.static,
): GovernanceAuthority {
	if (query.authorityKind === "platform") {
		if (query.authorityId !== undefined)
			throw new ValidationError({ authorityId: "must be omitted for platform authority" });
		return { kind: "platform" };
	}
	if (!query.authorityId)
		throw new ValidationError({ authorityId: "is required for non-platform authority" });
	if (query.authorityKind === "realm") return { kind: "realm", realmId: query.authorityId };
	if (query.authorityKind === "zone") return { kind: "zone", zoneId: query.authorityId };
	return { kind: "unit", unitId: query.authorityId };
}

type CaseRecord = typeof contentReviewCase.$inferSelect;
type PresentableCase = Pick<CaseRecord, "id" | "targetUnitId">;

async function presentContentReviewCases<T extends PresentableCase>(
	tx: DatabaseTransaction,
	rows: readonly T[],
) {
	const caseNotes = await listGovernanceNotes(tx, {
		subjectKind: "content_review_case",
		subjectIds: rows.map((row) => row.id),
		roles: ["internal_note"],
	});
	return rows.map((row) => ({
		...row,
		notes: caseNotes
			.filter((note) => note.subjectId === row.id && note.role === "internal_note")
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
		decisionCode?: string;
		subjectKind?: string;
		subjectId?: string;
		subjectPath?: string | null;
		authorityRealmId?: string;
		governanceDecisionId?: string;
		metadata?: Record<string, unknown>;
	},
) {
	await appendAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: input.authorityRealmId
			? { kind: "realm", id: input.authorityRealmId }
			: { kind: "platform" },
		action: input.action,
		governanceDecisionId: input.governanceDecisionId,
		outcomeCode:
			input.decisionCode && input.decisionCode !== "allowed" ? input.decisionCode : undefined,
		target: input.subjectKind
			? {
					kind: input.subjectKind,
					id: input.subjectId,
					path: input.subjectPath ?? undefined,
				}
			: undefined,
		details: input.metadata,
	});
}

export default new Elysia({ prefix: "/governance" })
	.use(session)
	.use(unitAccessRoutes)
	.use(unitAccessInvitationRoutes)
	.use(unitLifecycleRoutes)
	.use(unitMergeRoutes)
	.use(ownershipClaimRoutes)
	.get(
		"/rule-sources",
		async ({ authorization, query }) => {
			const authority = governanceRuleSourceAuthority(query);
			if (authority.kind !== "platform") {
				const authorityId =
					authority.kind === "realm"
						? authority.realmId
						: authority.kind === "zone"
							? authority.zoneId
							: authority.unitId;
				await authorization.unit.ensureCanRead(authorityId);
			}
			return database.transaction(async (tx) => {
				const sourceIds = await resolveGovernanceRuleSourceRealmIds(tx, authority);
				const items = (
					await Promise.all(
						sourceIds.map((sourceId) =>
							loadGovernanceRuleSource(
								tx,
								sourceId,
								sourceId === OfficialRealmUnitIds.rule
									? "platform"
									: authority.kind === "realm"
										? "realm"
										: "local",
								query.localizationLanguages,
							),
						),
					)
				).filter((item) => item !== undefined);
				if (!items.some((item) => item.scope === "platform"))
					throw new Error("REZICS Rule bootstrap Realm is unavailable");
				return { items };
			});
		},
		{
			access: "session-only",
			query: GovernanceRuleSourcesQuery,
			response: {
				[StatusCodes.OK]: GovernanceRuleSourcesResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["GovernanceRuleSourceForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
			},
			detail: {
				summary: "List current Rule sources for a governance authority",
				tags: ["Governance"],
			},
		},
	)
	.get(
		"/notes/:postId",
		async ({ params, authorization }) => {
			await authorization.unit.ensureCanRead(params.postId, () => new GovernanceNoteNotFound());
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
				if (!(await getGovernanceNote(tx, params.postId))) throw new GovernanceNoteNotFound();
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
				await recordUnitRevision(tx, {
					unitId: params.postId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
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
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["UnitPermissionForbidden"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "GovernanceNoteNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
			},
			detail: { summary: "Update governance note", tags: ["Governance"] },
		},
	)
	.get(
		"/content-review/cases",
		async ({ authorization, query }) => {
			await ensureCaseAccess(authorization, {
				authority: query.realmId ? "realm" : "platform",
				realmId: query.realmId ?? null,
			});
			return database.transaction(async (tx) => {
				const rows = await tx
					.select(caseSelection)
					.from(contentReviewCase)
					.where(
						and(
							eq(contentReviewCase.authority, query.realmId ? "realm" : "platform"),
							query.realmId ? eq(contentReviewCase.realmId, query.realmId) : undefined,
							query.state ? eq(contentReviewCase.state, query.state) : undefined,
						),
					)
					.orderBy(desc(contentReviewCase.createdAt), desc(contentReviewCase.id))
					.limit(query.limit ?? 50);
				return { items: await presentContentReviewCases(tx, rows) };
			});
		},
		{
			access: "session-only",
			query: ListContentReviewCasesQuery,
			response: {
				[StatusCodes.OK]: ContentReviewCaseListResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
			},
			detail: { summary: "List content review cases", tags: ["Governance"] },
		},
	)
	.get(
		"/content-review/cases/:caseId",
		async ({ authorization, params }) => {
			return database.transaction(async (tx) => {
				const [row] = await tx
					.select(caseSelection)
					.from(contentReviewCase)
					.where(eq(contentReviewCase.id, params.caseId))
					.limit(1);
				if (!row) throw new ModerationCaseNotFound();
				await ensureCaseAccess(authorization, row);
				const [presented] = await presentContentReviewCases(tx, [row]);
				if (!presented) throw new ModerationCaseNotFound();
				return presented;
			});
		},
		{
			access: "session-only",
			params: ContentReviewCaseParams,
			response: {
				[StatusCodes.OK]: ContentReviewCaseResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ContentReviewCaseNotFound"]),
			},
			detail: { summary: "Get content review case", tags: ["Governance"] },
		},
	)
	.patch(
		"/content-review/cases/:caseId",
		async ({ authorization, profile, params, body }) => {
			const [current] = await database
				.select()
				.from(contentReviewCase)
				.where(eq(contentReviewCase.id, params.caseId))
				.limit(1);
			if (!current) throw new ModerationCaseNotFound();
			await ensureCaseAccess(authorization, current);
			return database.transaction(async (tx) => {
				const { internalNote, revisionContext: _revisionContext, ...changes } = body;
				const rows = await tx
					.update(contentReviewCase)
					.set({ ...changes, updatedAt: new Date() })
					.where(eq(contentReviewCase.id, params.caseId))
					.returning(caseSelection);
				const [updated] = rows;
				if (!updated) throw new ModerationCaseNotFound();
				const note = internalNote
					? await createGovernanceNotePost(tx, {
							actorProfileId: profile.unitId,
							subjectKind: "content_review_case",
							subjectId: current.id,
							subjectUnitId: current.targetUnitId,
							realmId: current.realmId,
							revisionContribution: body.revisionContext?.contribution,
							note: { role: "internal_note", ...internalNote },
						})
					: undefined;
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "content_review.case.update",
					decisionCode: "allowed",
					subjectKind: "content_review_case",
					subjectId: params.caseId,
					authorityRealmId:
						current.authority === "realm" ? (current.realmId ?? undefined) : undefined,
					metadata: { changes, internalNotePostId: note?.postId },
				});
				const [presented] = await presentContentReviewCases(tx, [updated]);
				if (!presented) throw new ModerationCaseNotFound();
				return presented;
			});
		},
		{
			access: "session-only",
			params: ContentReviewCaseParams,
			body: UpdateContentReviewCaseBody,
			response: {
				[StatusCodes.OK]: ContentReviewCaseResponse,
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ContentReviewCaseNotFound"]),
			},
			detail: { summary: "Update content review case", tags: ["Governance"] },
		},
	)
	.post(
		"/content-governance/actions",
		async ({ authorization, profile, body }) => {
			const result = await database.transaction(async (tx) => {
				const caseRow = await loadContentReviewCaseForAction(tx, body.caseId);
				if (!caseRow) throw new ModerationCaseNotFound();
				await ensureCaseAccess(authorization, caseRow);
				if (isLicenseModerationCommand(body.kind))
					await authorization.platform.ensureCapability("unit.license.manage");
				return executeAuthorizedContentGovernanceAction(tx, {
					caseRow,
					actorProfileId: profile.unitId,
					body,
				});
			});
			return result.created;
		},
		{
			access: "session-only",
			body: CreateContentGovernanceActionBody,
			response: {
				[StatusCodes.OK]: ContentGovernanceActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"ContentGovernanceReversedActionInvalid",
					"ContentGovernanceActionIncompatible",
					"GovernanceNoteRoleDuplicate",
					"ContentReviewRealmMissing",
					"GovernanceRuleSourceForbidden",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ContentReviewCaseNotFound",
					"ContentGovernanceTargetNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"ContentGovernanceTransitionInvalid",
					"ContentGovernanceActionNoEffect",
					"ContentGovernanceReversalUnavailable",
					"GovernanceReversalUnavailable",
					"ContentGovernanceIdempotencyConflict",
					"GovernanceRuleChanged",
					"PostTargetingLocked",
				]),
			},
			detail: { summary: "Apply content governance action", tags: ["Governance"] },
		},
	)
	.post(
		"/account-enforcements",
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
				const decision = await createGovernanceDecision(tx, {
					action: "account.enforcement.create",
					actorProfileId: profile.unitId,
					authority: { kind: "platform" },
					targetUnitId: target.id,
					subject: { kind: "profile", id: target.id },
					basis: { kind: "rules", rules: body.rules },
				});
				const [action] = await tx
					.insert(accountEnforcementAction)
					.values({
						decisionId: decision.id,
						actorProfileId: profile.unitId,
						targetProfileId: target.id,
						kind: "issue",
						enforcementKind: body.kind,
					})
					.returning({ id: accountEnforcementAction.id });
				if (!action) throw new Error("Account enforcement action insertion returned no row");
				const notePostIds: string[] = [];
				let publicNoticePostId: string | undefined;
				for (const note of body.notes ?? []) {
					const createdNote = await createGovernanceNotePost(tx, {
						actorProfileId: profile.unitId,
						subjectKind: "account_enforcement_action",
						subjectId: action.id,
						subjectUnitId: target.id,
						publicRecipientProfileIds: [target.id],
						revisionContribution: body.revisionContext?.contribution,
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
				await createNotification(tx, {
					recipientProfileId: target.id,
					actorProfileId: profile.unitId,
					kind: "moderation",
					subjectUnitId: target.id,
					payload: {
						type: "account_enforcement_action",
						actionId: action.id,
						actionKind: "issue",
						enforcementKind: body.kind,
						publicNoticePostId,
					},
				});
				await recordAuditEvent(tx, {
					actorProfileId: profile.unitId,
					action: "account.enforcement.create",
					subjectKind: "profile",
					subjectId: target.id,
					governanceDecisionId: decision.id,
					metadata: { enforcementId: created.id, kind: body.kind, notePostIds },
				});
				return created;
			});
			return result;
		},
		{
			access: "session-only",
			body: CreateAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"EnforcementExpiryInvalid",
					"GovernanceNoteRoleDuplicate",
					"GovernanceRuleSourceForbidden",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ProfileNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["GovernanceRuleChanged"]),
			},
			detail: { summary: "Create account enforcement", tags: ["Governance"] },
		},
	)
	.post(
		"/account-enforcements/:enforcementId/revoke",
		async ({ authorization, profile, params, body }) => {
			await authorization.platform.ensureCapability("platform.moderate");
			if (new Set(body.notes?.map((note) => note.role)).size !== (body.notes?.length ?? 0))
				throw new ModerationNoteRoleDuplicate();
			const result = await database.transaction(async (tx) => {
				const [current] = await tx
					.select({
						id: accountEnforcement.id,
						profileId: accountEnforcement.profileId,
						kind: accountEnforcement.kind,
						decisionActionId: accountEnforcement.decisionActionId,
						decisionId: accountEnforcementAction.decisionId,
						revocationActionId: accountEnforcement.revocationActionId,
					})
					.from(accountEnforcement)
					.innerJoin(
						accountEnforcementAction,
						eq(accountEnforcementAction.id, accountEnforcement.decisionActionId),
					)
					.where(eq(accountEnforcement.id, params.enforcementId))
					.limit(1);
				if (!current) throw new EnforcementNotFound();
				if (current.revocationActionId) throw new EnforcementAlreadyRevoked();
				if (!current.decisionId) throw new GovernanceReversalUnavailable();
				const decision = await createGovernanceDecision(tx, {
					action: "account.enforcement.revoke",
					actorProfileId: profile.unitId,
					authority: { kind: "platform" },
					targetUnitId: current.profileId,
					subject: { kind: "profile", id: current.profileId },
					basis: { kind: "reversal", reversesDecisionId: current.decisionId },
				});
				const [action] = await tx
					.insert(accountEnforcementAction)
					.values({
						decisionId: decision.id,
						actorProfileId: profile.unitId,
						targetProfileId: current.profileId,
						kind: "revoke",
						enforcementKind: current.kind,
						reversesActionId: current.decisionActionId,
					})
					.returning({ id: accountEnforcementAction.id });
				if (!action) throw new Error("Account enforcement action insertion returned no row");
				const notePostIds: string[] = [];
				let publicNoticePostId: string | undefined;
				for (const note of body.notes ?? []) {
					const createdNote = await createGovernanceNotePost(tx, {
						actorProfileId: profile.unitId,
						subjectKind: "account_enforcement_action",
						subjectId: action.id,
						subjectUnitId: current.profileId,
						publicRecipientProfileIds: [current.profileId],
						revisionContribution: body.revisionContext?.contribution,
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
					subjectKind: "profile",
					subjectId: current.profileId,
					governanceDecisionId: decision.id,
					metadata: { enforcementId: current.id, notePostIds },
				});
				await createNotification(tx, {
					recipientProfileId: current.profileId,
					actorProfileId: profile.unitId,
					kind: "moderation",
					subjectUnitId: current.profileId,
					payload: {
						type: "account_enforcement_action",
						actionId: action.id,
						actionKind: "revoke",
						enforcementKind: current.kind,
						publicNoticePostId,
					},
				});
				return updated;
			});
			return result;
		},
		{
			access: "session-only",
			params: AccountEnforcementParams,
			body: RevokeAccountEnforcementBody,
			response: {
				[StatusCodes.OK]: EnforcementResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"GovernanceNoteRoleDuplicate",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: CapabilityForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EnforcementNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"EnforcementAlreadyRevoked",
					"EnforcementChanged",
					"GovernanceReversalUnavailable",
				]),
			},
			detail: { summary: "Revoke account enforcement", tags: ["Governance"] },
		},
	);
