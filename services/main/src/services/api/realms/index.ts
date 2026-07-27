import { StatusCodes } from "http-status-codes";
import { and, desc, eq, inArray, isNull, max, notInArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import { RealmRulesAcceptanceRequired } from "../../authorization/errors";
import {
	isRealmJoinable,
	isRealmVisible,
	type RealmCapability,
} from "../../authorization/realm/policy";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { ContentStructureSnapshotSchema } from "../../content-structure/contracts";
import { createContentStructureHistory } from "../../content-structure/history";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	avatarReferenceFromColumns,
	makePrimaryUnitLocalization,
	primaryUnitTitle,
	resolveUnitLocalizationFromOrdered,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	auditEvent,
	contentStructure,
	moderationAction,
	moderationCase,
	post,
	profile as profileTable,
	realm,
	realmUnit,
	realmMember,
	realmPin,
	realmRule,
	realmRuleAcceptance,
	realmRuleRevision,
	realmScoreContext,
	realmTagContext,
	realmTagVote,
	realmTagVoteStat,
	tag,
	unitFollow,
	unit,
	unitAccessGrant,
	unitOwnership,
	unitLocalization,
} from "../../database/schema";
import { listGovernanceNotes } from "../../governance/note-service";
import { createNotification } from "../../notifications/service";
import { findRealmMembership, getCurrentRealmRules } from "../../realms/service";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { transitionUnitStatus } from "../../units/status";
import {
	getPublicCanonicalUnitSlugAddress,
	getPublicCanonicalUnitSlugAddresses,
} from "../../units/slug-address";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { presentImageAsset } from "../../units/service";
import { presentAvatar } from "../../units/avatar";
import {
	IdResponse,
	MembershipResponse,
	NoContentResponse,
	RealmMemberListResponse,
	RealmMemberResponse,
	RealmPinListResponse,
	RealmPinResponse,
	RealmRuleRevisionResponse,
	RealmRulesResponse,
	ScoreContextResponse,
} from "../schema/action-response";
import {
	toApiErrorResponse,
	RealmDetailResponse,
	RealmListResponse,
	toPortableTextResponse,
} from "../schema/response";
import {
	CreateRealmBody,
	CreateRealmPinBody,
	JoinRealmBody,
	ListRealmMembersQuery,
	ListRealmUnitsQuery,
	ListRealmsQuery,
	ModerateRealmUnitBody,
	PublishRealmRulesBody,
	RealmUnitParams,
	RealmTagParams,
	PutRealmTagContextBody,
	RealmTagVoteBody,
	RealmTagContextResponse,
	RealmUnitListResponse,
	RealmUnitHistoryQuery,
	RealmUnitModerationHistoryResponse,
	RealmMemberParams,
	RealmParams,
	RealmDetailQuery,
	RealmRulesQuery,
	SetRealmScoreContextBody,
	RealmPinParams,
	RemoveRealmPinQuery,
	UpdateRealmBody,
	UpdateRealmMemberBody,
} from "./schema";
import {
	executeAuthorizedModerationAction,
	loadModerationCaseForAction,
} from "../governance/moderation-service";
import { type CreateModerationActionBody, ModerationActionResponse } from "../governance/schema";
import {
	GovernanceReasonCodeValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";
import {
	RealmUnitNotFound,
	RealmMemberNotFound,
	RealmMembershipNotFound,
	RealmNotFound,
	RealmOwnerLeaveForbidden,
	RealmScoreContextPostNotMounted,
	RealmTagContextNotFound,
	RealmTagContextPostNotMounted,
} from "./errors";
import { PostNotFound } from "../posts/errors";
import { UnitNotFound } from "../../units/errors";
import {
	ReplacePublicUnitSlugAddressBody,
	SlugAddressMutationResponse,
} from "../slug-addresses/schema";
import { replaceRealmSlugAddress } from "../../units/slug-address";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { hydrateFeedItems } from "../feed";
import { FeedContentKindValues } from "../feed/schema";

const RealmNotFoundResponse = toApiErrorResponse(["RealmNotFound"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const RealmMutationNotFoundResponse = toApiErrorResponse(["RealmNotFound", "ImageAssetNotFound"]);
const RealmMutationForbiddenResponse = toApiErrorResponse(["RealmCapabilityRequired"]);

function presentRealmUnitStatus(value: string | null) {
	if (value === null) return null;
	const status = RealmUnitStatusValues.find((candidate) => candidate === value);
	if (!status) throw new Error("Realm moderation action has an invalid state outcome");
	return status;
}

function presentGovernanceReasonCode(value: string) {
	const reasonCode = GovernanceReasonCodeValues.find((candidate) => candidate === value);
	if (!reasonCode) throw new Error("Realm moderation action has an invalid reason code");
	return reasonCode;
}

async function ensureRealmFieldsAuthorized(
	authorization: Authorization<string>,
	realmId: string,
	capability: RealmCapability,
	_scope: readonly string[],
): Promise<void> {
	await authorization.realm.ensureCapability(realmId, capability);
}

async function ensureRealmVisible(realmId: string, headers: Headers) {
	const [record] = await database
		.select({ status: unit.status, visibility: unit.visibility })
		.from(realm)
		.innerJoin(unit, eq(unit.id, realm.id))
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new RealmNotFound();
	const identity = await resolveIdentity(headers, "realm:read");
	const { profile } = identity;
	const membership = profile ? await findRealmMembership(realmId, profile.unitId) : undefined;
	if (!isRealmVisible(record.status, record.visibility, membership?.state))
		throw new RealmNotFound();
	return identity;
}

async function recordAuditEvent(
	tx: DatabaseTransaction,
	actorProfileId: string,
	action: string,
	subjectId: string,
	metadata?: Record<string, unknown>,
) {
	await tx.insert(auditEvent).values({
		actorProfileId,
		action,
		decisionCode: "allowed",
		subjectKind: "unit",
		subjectId,
		metadata,
	});
}

function presentRealmTagVote(value: number | null): -1 | 1 | null {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Realm Tag vote has an invalid persisted value");
}

async function getRealmTagContextSummary(
	realmId: string,
	unitId: string,
	tagId: string,
	profileId?: string,
) {
	const [record] = await database
		.select({
			realmId: realmTagContext.realmId,
			unitId: realmTagContext.unitId,
			tagId: realmTagContext.tagId,
			contextPostId: realmTagContext.contextPostId,
			createdByProfileId: realmTagContext.createdByProfileId,
			value: realmTagVote.value,
			score: realmTagVoteStat.score,
			voteCount: realmTagVoteStat.voteCount,
			createdAt: realmTagContext.createdAt,
			updatedAt: realmTagContext.updatedAt,
		})
		.from(realmTagContext)
		.leftJoin(
			realmTagVoteStat,
			and(
				eq(realmTagVoteStat.realmId, realmTagContext.realmId),
				eq(realmTagVoteStat.unitId, realmTagContext.unitId),
				eq(realmTagVoteStat.tagId, realmTagContext.tagId),
			),
		)
		.leftJoin(
			realmTagVote,
			profileId
				? and(
						eq(realmTagVote.realmId, realmTagContext.realmId),
						eq(realmTagVote.unitId, realmTagContext.unitId),
						eq(realmTagVote.tagId, realmTagContext.tagId),
						eq(realmTagVote.profileId, profileId),
					)
				: sql`false`,
		)
		.where(
			and(
				eq(realmTagContext.realmId, realmId),
				eq(realmTagContext.unitId, unitId),
				eq(realmTagContext.tagId, tagId),
			),
		)
		.limit(1);
	if (!record) throw new RealmTagContextNotFound();
	return {
		...record,
		value: presentRealmTagVote(record.value),
		score: toSafeInteger(record.score ?? 0n, "Realm Tag vote score"),
		voteCount: toSafeInteger(record.voteCount ?? 0n, "Realm Tag vote count"),
	};
}

export default new Elysia({ prefix: "/realms" })
	.use(session)
	.get(
		"",
		async ({ query }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const items = await database
				.select({
					id: realm.id,
					joinPolicy: realm.joinPolicy,
					memberCount: sql<number>`(
						select count(*)::int
						from ${realmMember}
						where ${realmMember.realmId} = ${realm.id}
							and ${realmMember.state} = 'active'
					)`,
					language: unitLocalization.language,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					avatarType: unitLocalization.avatarType,
					avatarAssetId: unitLocalization.avatarAssetId,
					avatarEmoji: unitLocalization.avatarEmoji,
					avatarIconPrefix: unitLocalization.avatarIconPrefix,
					avatarIconName: unitLocalization.avatarIconName,
					bannerAssetId: unitLocalization.bannerAssetId,
					coverAssetId: unitLocalization.coverAssetId,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, unit.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
						),
					),
				)
				.where(and(eq(unit.status, "published"), eq(unit.visibility, "public")))
				.orderBy(desc(unit.createdAt), desc(unit.id))
				.limit(query.limit ?? 20);
			const slugAddresses = await getPublicCanonicalUnitSlugAddresses(
				items.map((item) => item.id),
			);
			return {
				items: items.map(
					({
						avatarType,
						avatarAssetId,
						avatarEmoji,
						avatarIconPrefix,
						avatarIconName,
						bannerAssetId,
						coverAssetId,
						...item
					}) => ({
						...item,
						slugAddress: slugAddresses.get(item.id) ?? null,
						avatar: presentAvatar(
							avatarReferenceFromColumns({
								avatarType,
								avatarAssetId,
								avatarEmoji,
								avatarIconPrefix,
								avatarIconName,
							}),
						),
						banner: presentImageAsset(bannerAssetId, "banner"),
						cover: presentImageAsset(coverAssetId, "cover"),
					}),
				),
			};
		},
		{
			query: ListRealmsQuery,
			response: { [StatusCodes.OK]: RealmListResponse },
			detail: { summary: "List Realms", tags: ["Realms"] },
		},
	)
	.post(
		"",
		async ({ profile, body }) => {
			const id = await database.transaction(async (tx) => {
				await ensureImageAssetsAttachable(
					tx,
					profile.unitId,
					unitLocalizationImageAssetReferences(body.localization),
				);
				const created = await insertUnit(tx, {
					kind: "realm",
					status: "published",
					visibility: body.visibility,
					publishedAt: new Date(),
					statusActor: { kind: "profile", profileId: profile.unitId },
				});
				await tx.insert(realm).values({ id: created.id, joinPolicy: body.joinPolicy });
				const [taxonomy] = await tx
					.insert(contentStructure)
					.values({ ownerUnitId: created.id, kind: "realm.taxonomy" })
					.returning();
				if (!taxonomy) throw new Error("Realm taxonomy insertion returned no row");
				await tx.insert(unitLocalization).values({
					unitId: created.id,
					...toUnitLocalizationStorage(body.localization),
				});
				await tx.insert(unitOwnership).values({
					unitId: created.id,
					profileId: profile.unitId,
					assignedByProfileId: profile.unitId,
				});
				await tx.insert(realmMember).values({
					realmId: created.id,
					profileId: profile.unitId,
				});
				await tx.insert(unitAccessGrant).values(
					(["unit.read", "realm.contribute"] as const).map((permission) => ({
						unitId: created.id,
						subjectKind: "realm" as const,
						realmId: created.id,
						permission,
						scope: [],
						grantedByProfileId: profile.unitId,
					})),
				);
				await tx.insert(unitFollow).values({
					followerProfileId: profile.unitId,
					unitId: created.id,
				});
				const taxonomySnapshot = ContentStructureSnapshotSchema.parse({
					version: 1,
					structure: taxonomy,
					nodes: [],
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: profile.unitId,
					event: "create",
				});
				await createContentStructureHistory(tx, {
					structureId: taxonomy.id,
					actorProfileId: profile.unitId,
					state: taxonomySnapshot,
				});
				return created.id;
			});
			return { id };
		},
		{
			access: "contribute:unit:create",
			body: CreateRealmBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
			},
			detail: { summary: "Create Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/slug-address",
		async ({ params, authorization, body }) => {
			const result = await replaceRealmSlugAddress(authorization, {
				realmId: params.realmId,
				slug: body.slug,
			});
			return { ...result, canonicalPath: [...result.canonicalPath] };
		},
		{
			access: "contribute:unit:update",
			params: RealmParams,
			body: ReplacePublicUnitSlugAddressBody,
			response: {
				[StatusCodes.OK]: SlugAddressMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound", "UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"SlugTaken",
					"SlugScopeUnavailable",
					"SlugScopeCycle",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
			},
			detail: {
				operationId: "replaceRealmSlugAddress",
				summary: "Replace a Realm slug address",
				description:
					"Assigns or renames a Realm's optional public slug in the permanent realms namespace. The former address is retained as a redirect.",
				tags: ["Realms", "Slug Addresses"],
			},
		},
	)
	.get(
		"/:realmId",
		async ({ params, query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const { profile: viewer, authorization } = await ensureRealmVisible(
				params.realmId,
				request.headers,
			);
			const [record] = await database
				.select({
					id: realm.id,
					status: unit.status,
					visibility: unit.visibility,
					joinPolicy: realm.joinPolicy,
					memberCount: sql<number>`(
						select count(*)::int
						from ${realmMember}
						where ${realmMember.realmId} = ${realm.id}
							and ${realmMember.state} = 'active'
					)`,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.where(eq(realm.id, params.realmId))
				.limit(1);
			if (!record) throw new RealmNotFound();
			const localizations = await database
				.select({
					language: unitLocalization.language,
					position: unitLocalization.position,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					avatarType: unitLocalization.avatarType,
					avatarAssetId: unitLocalization.avatarAssetId,
					avatarEmoji: unitLocalization.avatarEmoji,
					avatarIconPrefix: unitLocalization.avatarIconPrefix,
					avatarIconName: unitLocalization.avatarIconName,
					bannerAssetId: unitLocalization.bannerAssetId,
					coverAssetId: unitLocalization.coverAssetId,
				})
				.from(unitLocalization)
				.where(eq(unitLocalization.unitId, params.realmId))
				.orderBy(unitLocalization.position, unitLocalization.language);
			const selectedLocalization = resolveUnitLocalizationFromOrdered(
				localizations,
				localizationLanguages,
			);
			if (!selectedLocalization) throw new RealmNotFound();
			const [viewerMembership, following] = viewer
				? await Promise.all([
						findRealmMembership(params.realmId, viewer.unitId),
						database
							.select({ realmId: unitFollow.unitId })
							.from(unitFollow)
							.where(
								and(
									eq(unitFollow.followerProfileId, viewer.unitId),
									eq(unitFollow.unitId, params.realmId),
								),
							),
					])
				: [undefined, []];
			const [ownership] = await database
				.select({ profileId: unitOwnership.profileId })
				.from(unitOwnership)
				.where(
					and(eq(unitOwnership.unitId, params.realmId), isNull(unitOwnership.revokedAt)),
				)
				.limit(1);
			const [realmCapabilities, accessDecision, historyDecision] = await Promise.all([
				authorization.realm.decideCapabilities(params.realmId, [
					"realm.settings.update",
					"realm.members.read",
					"realm.members.manage",
					"realm.rules.publish",
					"realm.pins.manage",
					"realm.units.moderate",
				]),
				authorization.unit.decide(params.realmId, "unit.access.manage"),
				authorization.unit.decide(params.realmId, "unit.history.restore"),
			]);
			const realmRecord = record;
			return {
				...realmRecord,
				slugAddress: await getPublicCanonicalUnitSlugAddress(record.id),
				language: selectedLocalization.language,
				avatar: presentAvatar(avatarReferenceFromColumns(selectedLocalization)),
				banner: presentImageAsset(selectedLocalization.bannerAssetId, "banner"),
				cover: presentImageAsset(selectedLocalization.coverAssetId, "cover"),
				localizations: localizations.map(
					({
						avatarType,
						avatarAssetId,
						avatarEmoji,
						avatarIconPrefix,
						avatarIconName,
						bannerAssetId,
						coverAssetId,
						position: _position,
						...localization
					}) => ({
						...localization,
						avatar: presentAvatar(
							avatarReferenceFromColumns({
								avatarType,
								avatarAssetId,
								avatarEmoji,
								avatarIconPrefix,
								avatarIconName,
							}),
						),
						banner: presentImageAsset(bannerAssetId, "banner"),
						cover: presentImageAsset(coverAssetId, "cover"),
					}),
				),
				viewerMembership: viewerMembership
					? {
							isOwner: ownership?.profileId === viewerMembership.profileId,
							state: viewerMembership.state,
						}
					: undefined,
				viewerFollowing: following.length > 0,
				capabilities: {
					canUpdateSettings: realmCapabilities.get("realm.settings.update") ?? false,
					canReadMembers: realmCapabilities.get("realm.members.read") ?? false,
					canManageMembers: realmCapabilities.get("realm.members.manage") ?? false,
					canPublishRules: realmCapabilities.get("realm.rules.publish") ?? false,
					canManagePins: realmCapabilities.get("realm.pins.manage") ?? false,
					canModerateUnits: realmCapabilities.get("realm.units.moderate") ?? false,
					canManageAccess: accessDecision.allowed,
					canRestoreHistory: historyDecision.allowed,
				},
			};
		},
		{
			params: RealmParams,
			query: RealmDetailQuery,
			response: {
				[StatusCodes.OK]: RealmDetailResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get Realm", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/score-context",
		async ({ params, request }) => {
			const authorization = (await resolveIdentity(request.headers, "unit:read"))
				.authorization;
			await authorization.unit.ensureCanRead(params.realmId, () => new RealmNotFound());
			const [context] = await database
				.select({ contextPostId: realmScoreContext.contextPostId })
				.from(realmScoreContext)
				.where(eq(realmScoreContext.realmId, params.realmId))
				.limit(1);
			if (context)
				await authorization.unit.ensureCanRead(
					context.contextPostId,
					() => new PostNotFound(),
				);
			return { contextPostId: context?.contextPostId ?? null };
		},
		{
			params: RealmParams,
			response: {
				[StatusCodes.OK]: ScoreContextResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound", "PostNotFound"]),
			},
			detail: { summary: "Get Realm Score context", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/score-context",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			await authorization.unit.ensureCanRead(body.contextPostId, () => new PostNotFound());
			const [mountedPost] = await database
				.select({ id: post.id })
				.from(post)
				.innerJoin(
					realmUnit,
					and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, post.id)),
				)
				.where(eq(post.id, body.contextPostId))
				.limit(1);
			if (!mountedPost) throw new RealmScoreContextPostNotMounted();
			await database
				.insert(realmScoreContext)
				.values({
					realmId: params.realmId,
					contextPostId: body.contextPostId,
					createdByProfileId: profile.unitId,
				})
				.onConflictDoUpdate({
					target: realmScoreContext.realmId,
					set: { contextPostId: body.contextPostId, updatedAt: new Date() },
				});
			return { contextPostId: body.contextPostId };
		},
		{
			access: "session-only",
			params: RealmParams,
			body: SetRealmScoreContextBody,
			response: {
				[StatusCodes.OK]: ScoreContextResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["PostNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"RealmScoreContextPostNotMounted",
				]),
			},
			detail: { summary: "Set Realm Score context", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/score-context",
		async ({ params, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			await database
				.delete(realmScoreContext)
				.where(eq(realmScoreContext.realmId, params.realmId));
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: RealmParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: {
				summary: "Clear Realm Score context",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.patch(
		"/:realmId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			const publishDecision = body.status
				? await authorization.unit.decide(params.realmId, "unit.publish", ["unit"])
				: undefined;
			const [current] = await database
				.select({ id: unit.id })
				.from(unit)
				.where(and(eq(unit.id, params.realmId), eq(unit.kind, "realm")))
				.limit(1);
			if (!current) throw new RealmNotFound();
			await database.transaction(async (tx) => {
				if (body.localization)
					await ensureImageAssetsAttachable(
						tx,
						profile.unitId,
						unitLocalizationImageAssetReferences(body.localization),
					);
				const updated = await tx
					.update(unit)
					.set({
						visibility: body.visibility,
					})
					.where(and(eq(unit.id, params.realmId), eq(unit.kind, "realm")))
					.returning({ id: unit.id });
				if (!updated.length) throw new RealmNotFound();
				if (body.joinPolicy)
					await tx
						.update(realm)
						.set({ joinPolicy: body.joinPolicy })
						.where(eq(realm.id, params.realmId));
				if (body.localization) {
					const storedLocalization = toUnitLocalizationStorage(body.localization);
					await tx
						.insert(unitLocalization)
						.values({ unitId: params.realmId, ...storedLocalization })
						.onConflictDoUpdate({
							target: [unitLocalization.unitId, unitLocalization.language],
							set: storedLocalization,
						});
					await makePrimaryUnitLocalization(
						tx,
						params.realmId,
						body.localization.language,
					);
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				if (body.status)
					await transitionUnitStatus(tx, {
						unitId: params.realmId,
						toStatus: body.status,
						actor: { kind: "profile", profileId: profile.unitId },
						authorization: {
							kind: "interactive",
							publishAllowed: publishDecision?.allowed ?? false,
						},
						revisionId: revision.revisionId,
					});
				await recordAuditEvent(tx, profile.unitId, "realm.settings.update", params.realmId);
			});
			return { id: params.realmId };
		},
		{
			access: "contribute:interaction:write",
			params: RealmParams,
			body: UpdateRealmBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmMutationNotFoundResponse,
			},
			detail: { summary: "Update Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/membership",
		async ({ params, profile, body }) => {
			const [record] = await database
				.select({
					status: unit.status,
					visibility: unit.visibility,
					joinPolicy: realm.joinPolicy,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.where(eq(realm.id, params.realmId))
				.limit(1);
			if (!record) throw new RealmNotFound();
			const current = await findRealmMembership(params.realmId, profile.unitId);
			if (!isRealmJoinable(record.status, record.visibility, current?.state))
				throw new RealmNotFound();
			const state = record.joinPolicy === "approval" ? "pending" : "active";
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const [rules] = await tx
					.select({
						id: realmRuleRevision.id,
						requireOnJoin: realmRuleRevision.requireOnJoin,
					})
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId))
					.orderBy(desc(realmRuleRevision.version))
					.limit(1);
				if (rules?.requireOnJoin && rules.id !== body.ruleRevisionId)
					throw new RealmRulesAcceptanceRequired({ revisionId: rules.id });
				await tx
					.insert(realmMember)
					.values({ realmId: params.realmId, profileId: profile.unitId, state })
					.onConflictDoUpdate({
						target: [realmMember.realmId, realmMember.profileId],
						set: { state },
					});
				await tx
					.insert(unitFollow)
					.values({ followerProfileId: profile.unitId, unitId: params.realmId })
					.onConflictDoNothing();
				if (rules && rules.id === body.ruleRevisionId)
					await tx
						.insert(realmRuleAcceptance)
						.values({
							revisionId: rules.id,
							profileId: profile.unitId,
							language: body.language,
						})
						.onConflictDoNothing();
			});
			return { state };
		},
		{
			access: "contribute:interaction:write",
			params: RealmParams,
			body: JoinRealmBody,
			response: {
				[StatusCodes.OK]: MembershipResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmRulesAcceptanceRequired"]),
			},
			detail: { summary: "Join Realm", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/membership",
		async ({ params, profile }) => {
			await database.transaction(async (tx) => {
				const [membership] = await tx
					.select({ profileId: realmMember.profileId })
					.from(realmMember)
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, profile.unitId),
						),
					)
					.limit(1);
				if (!membership) throw new RealmMembershipNotFound();
				const [ownership] = await tx
					.select({ id: unitOwnership.id })
					.from(unitOwnership)
					.where(
						and(
							eq(unitOwnership.unitId, params.realmId),
							eq(unitOwnership.profileId, profile.unitId),
							isNull(unitOwnership.revokedAt),
						),
					)
					.limit(1);
				if (ownership) throw new RealmOwnerLeaveForbidden();
				await tx
					.delete(realmMember)
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, profile.unitId),
						),
					);
				await tx
					.delete(unitFollow)
					.where(
						and(
							eq(unitFollow.followerProfileId, profile.unitId),
							eq(unitFollow.unitId, params.realmId),
						),
					);
				const revisions = tx
					.select({ id: realmRuleRevision.id })
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId));
				await tx
					.delete(realmRuleAcceptance)
					.where(
						and(
							eq(realmRuleAcceptance.profileId, profile.unitId),
							inArray(realmRuleAcceptance.revisionId, revisions),
						),
					);
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmMembershipNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmOwnerLeaveForbidden"]),
			},
			detail: {
				summary: "Leave Realm",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/members",
		async ({ params, authorization, query }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.members.read");
			const [ownership] = await database
				.select({ profileId: unitOwnership.profileId })
				.from(unitOwnership)
				.where(
					and(eq(unitOwnership.unitId, params.realmId), isNull(unitOwnership.revokedAt)),
				)
				.limit(1);
			const members = await database
				.select({
					profileId: realmMember.profileId,
					language: resolvedUnitLocalizationLanguage(
						profileTable.id,
						query.localizationLanguages,
					),
					name: resolvedUnitLocalizationTitle(
						profileTable.id,
						query.localizationLanguages,
					),
					avatar: resolvedUnitLocalizationAvatar(
						profileTable.id,
						query.localizationLanguages,
					),
					state: realmMember.state,
					joinedAt: realmMember.joinedAt,
				})
				.from(realmMember)
				.innerJoin(profileTable, eq(profileTable.id, realmMember.profileId))
				.where(
					and(
						eq(realmMember.realmId, params.realmId),
						query.profileId ? eq(realmMember.profileId, query.profileId) : undefined,
						query.state ? eq(realmMember.state, query.state) : undefined,
					),
				)
				.orderBy(desc(realmMember.joinedAt), desc(realmMember.profileId))
				.limit(query.limit ?? 50);
			const slugAddresses = await getPublicCanonicalUnitSlugAddresses(
				members.map((member) => member.profileId),
			);
			return {
				items: members.map(({ avatar, ...member }) => {
					if (!member.language)
						throw new Error(`Realm member ${member.profileId} has no localization`);
					return {
						...member,
						isOwner: ownership?.profileId === member.profileId,
						language: member.language,
						slugAddress: slugAddresses.get(member.profileId) ?? null,
						avatar: presentAvatar(avatar),
					};
				}),
			};
		},
		{
			access: "realm:read",
			params: RealmParams,
			query: ListRealmMembersQuery,
			response: {
				[StatusCodes.OK]: RealmMemberListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
			},
			detail: { summary: "List Realm members", tags: ["Realms"] },
		},
	)
	.patch(
		"/:realmId/members/:profileId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.members.manage");
			const target = await findRealmMembership(params.realmId, params.profileId);
			if (!target) throw new RealmMemberNotFound();
			const result = await database.transaction(async (tx) => {
				const [targetOwnership] = await tx
					.select({ id: unitOwnership.id })
					.from(unitOwnership)
					.where(
						and(
							eq(unitOwnership.unitId, params.realmId),
							eq(unitOwnership.profileId, params.profileId),
							isNull(unitOwnership.revokedAt),
						),
					)
					.limit(1);
				if (targetOwnership && body.state !== "active")
					throw new RealmOwnerLeaveForbidden();
				const [row] = await tx
					.update(realmMember)
					.set({ state: body.state })
					.where(
						and(
							eq(realmMember.realmId, params.realmId),
							eq(realmMember.profileId, params.profileId),
						),
					)
					.returning();
				if (!row) throw new RealmMemberNotFound();
				await createNotification(tx, {
					recipientProfileId: params.profileId,
					actorProfileId: profile.unitId,
					kind: "realm",
					subjectUnitId: params.realmId,
					payload: { type: "realm_event", event: "membership_updated" },
				});
				await recordAuditEvent(tx, profile.unitId, "realm.members.update", params.realmId, {
					profileId: params.profileId,
				});
				return { ...row, isOwner: Boolean(targetOwnership) };
			});
			return result;
		},
		{
			access: "contribute:realm:manage",
			params: RealmMemberParams,
			body: UpdateRealmMemberBody,
			response: {
				[StatusCodes.OK]: RealmMemberResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmMemberNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmOwnerLeaveForbidden"]),
			},
			detail: { summary: "Update Realm member", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/rules",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(
				authorization,
				params.realmId,
				"realm.rules.publish",
				["rules"],
			);
			const revision = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const [latest] = await tx
					.select({ version: max(realmRuleRevision.version) })
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId));
				const [created] = await tx
					.insert(realmRuleRevision)
					.values({
						realmId: params.realmId,
						version: Number(latest?.version ?? 0) + 1,
						requireOnJoin: body.requireOnJoin,
						requireOnPost: body.requireOnPost,
						requireOnUpdate: body.requireOnUpdate,
						createdByProfileId: profile.unitId,
					})
					.returning();
				if (!created) throw new Error("Realm rule revision insertion did not return a row");
				for (const [index, rule] of body.rules.entries()) {
					const ruleUnit = await insertUnit(tx, {
						kind: "realm_rule",
						status: "published",
						visibility: "unlisted",
						publishedAt: new Date(),
						statusActor: { kind: "profile", profileId: profile.unitId },
					});
					await tx.insert(unitLocalization).values({
						unitId: ruleUnit.id,
						language: rule.language,
						title: rule.title,
						content: rule.content,
						contentStatus: "published",
					});
					await tx.insert(unitOwnership).values({
						unitId: ruleUnit.id,
						profileId: profile.unitId,
						assignedByProfileId: profile.unitId,
					});
					await tx.insert(realmRule).values({
						id: ruleUnit.id,
						revisionId: created.id,
						position: index,
					});
				}
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.rules.publish", params.realmId);
				return created;
			});
			return { id: revision.id, version: revision.version };
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			body: PublishRealmRulesBody,
			response: {
				[StatusCodes.OK]: RealmRuleRevisionResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: { summary: "Publish Realm rules", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/rules",
		async ({ params, query, request }) => {
			await ensureRealmVisible(params.realmId, request.headers);
			const current = await getCurrentRealmRules(params.realmId);
			if (!current)
				return {
					revisionId: null,
					version: null,
					requireOnJoin: false,
					requireOnPost: false,
					requireOnUpdate: false,
					items: [],
				};
			const items = await database
				.select({
					id: realmRule.id,
					position: realmRule.position,
					language: unitLocalization.language,
					title: unitLocalization.title,
					content: unitLocalization.content,
				})
				.from(realmRule)
				.innerJoin(
					unitLocalization,
					and(
						eq(unitLocalization.unitId, realmRule.id),
						eq(
							unitLocalization.language,
							resolvedUnitLocalizationLanguage(
								realmRule.id,
								query.localizationLanguages,
							),
						),
					),
				)
				.where(eq(realmRule.revisionId, current.revisionId))
				.orderBy(realmRule.position, realmRule.id);
			return {
				...current,
				items: items.map((item) => {
					if (!item.title)
						throw new Error(`Realm rule ${item.id} has no localized title`);
					return {
						...item,
						title: item.title,
						content: toPortableTextResponse(item.content),
					};
				}),
			};
		},
		{
			params: RealmParams,
			query: RealmRulesQuery,
			response: {
				[StatusCodes.OK]: RealmRulesResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get current Realm rules", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/pins",
		async ({ params, request }) => {
			await ensureRealmVisible(params.realmId, request.headers);
			const identity = await resolveIdentity(request.headers, "unit:read");
			const items = await database
				.select({
					realmId: realmPin.realmId,
					unitId: realmPin.unitId,
					kind: realmPin.kind,
					position: realmPin.position,
					createdAt: realmPin.createdAt,
					updatedAt: realmPin.updatedAt,
				})
				.from(realmPin)
				.where(eq(realmPin.realmId, params.realmId))
				.orderBy(realmPin.kind, realmPin.position, realmPin.unitId);
			const viewer = await resolveRecommendationViewer(
				identity.authorization.profileId,
				false,
			);
			return {
				items,
				contentItems: await hydrateFeedItems(
					items.map((item) => ({
						id: item.unitId,
						realmId: params.realmId,
					})),
					viewer,
					{ content: FeedContentKindValues },
					new Date(),
					{ kind: "contextual" },
				),
			};
		},
		{
			params: RealmParams,
			response: {
				[StatusCodes.OK]: RealmPinListResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "List Realm pins", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const kind = body.kind ?? "pinned";
				const [last] = await tx
					.select({ position: realmPin.position })
					.from(realmPin)
					.where(and(eq(realmPin.realmId, params.realmId), eq(realmPin.kind, kind)))
					.orderBy(desc(realmPin.position), desc(realmPin.unitId))
					.limit(1);
				const position = body.position ?? fractionalPositionBetween(last?.position, null);
				const [entry] = await tx
					.insert(realmPin)
					.values({
						realmId: params.realmId,
						unitId: params.unitId,
						kind,
						position,
						createdByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [realmPin.realmId, realmPin.unitId],
						set: body.position === undefined ? { kind } : { kind, position },
					})
					.returning();
				if (!entry) throw new Error("Realm pin upsert did not return a row");
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.pins.upsert", params.unitId, {
					realmId: params.realmId,
				});
				return entry;
			});
		},
		{
			access: "contribute:realm:manage",
			params: RealmPinParams,
			body: CreateRealmPinBody,
			response: {
				[StatusCodes.OK]: RealmPinResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Pin Realm unit", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, query }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			await database.transaction(async (tx) => {
				const deleted = await tx
					.delete(realmPin)
					.where(
						and(
							eq(realmPin.realmId, params.realmId),
							eq(realmPin.unitId, params.unitId),
							query.kind ? eq(realmPin.kind, query.kind) : undefined,
						),
					)
					.returning({ unitId: realmPin.unitId });
				if (!deleted.length) return;
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.pins.delete", params.unitId, {
					realmId: params.realmId,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:realm:manage",
			params: RealmPinParams,
			query: RemoveRealmPinQuery,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: {
				summary: "Remove Realm pin",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/units/:unitId/tags/:tagId/context",
		async ({ params, request }) => {
			const { profile, authorization } = await ensureRealmVisible(
				params.realmId,
				request.headers,
			);
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
			]);
			const record = await getRealmTagContextSummary(
				params.realmId,
				params.unitId,
				params.tagId,
				profile?.unitId,
			);
			await authorization.unit.ensureCanRead(record.contextPostId, () => new PostNotFound());
			return record;
		},
		{
			params: RealmTagParams,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"RealmNotFound",
					"UnitNotFound",
					"PostNotFound",
					"RealmTagContextNotFound",
				]),
			},
			detail: { summary: "Get Realm-scoped Tag voting context", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/units/:unitId/tags/:tagId/context",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureParticipation(params.realmId);
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
				authorization.unit.ensureCanRead(body.contextPostId, () => new PostNotFound()),
			]);
			const [[tagRecord], [mounted]] = await Promise.all([
				database.select({ id: tag.id }).from(tag).where(eq(tag.id, params.tagId)).limit(1),
				database
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.innerJoin(post, eq(post.id, realmUnit.unitId))
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, body.contextPostId),
							eq(realmUnit.status, "visible"),
						),
					)
					.limit(1),
			]);
			if (!tagRecord) throw new UnitNotFound("Tag");
			if (!mounted) throw new RealmTagContextPostNotMounted();
			await database
				.insert(realmTagContext)
				.values({
					realmId: params.realmId,
					unitId: params.unitId,
					tagId: params.tagId,
					contextPostId: body.contextPostId,
					createdByProfileId: profile.unitId,
				})
				.onConflictDoUpdate({
					target: [
						realmTagContext.realmId,
						realmTagContext.unitId,
						realmTagContext.tagId,
					],
					set: {
						contextPostId: body.contextPostId,
						createdByProfileId: profile.unitId,
						updatedAt: new Date(),
					},
				});
			return getRealmTagContextSummary(
				params.realmId,
				params.unitId,
				params.tagId,
				profile.unitId,
			);
		},
		{
			access: "contribute:interaction:write",
			params: RealmTagParams,
			body: PutRealmTagContextBody,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "PostNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"RealmTagContextPostNotMounted",
				]),
			},
			detail: { summary: "Set Realm-scoped Tag voting context", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/units/:unitId/tags/:tagId/vote",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureParticipation(params.realmId);
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
			]);
			await getRealmTagContextSummary(params.realmId, params.unitId, params.tagId);
			await database
				.insert(realmTagVote)
				.values({
					realmId: params.realmId,
					unitId: params.unitId,
					tagId: params.tagId,
					profileId: profile.unitId,
					value: body.value,
				})
				.onConflictDoUpdate({
					target: [
						realmTagVote.realmId,
						realmTagVote.unitId,
						realmTagVote.tagId,
						realmTagVote.profileId,
					],
					set: { value: body.value, updatedAt: new Date() },
				});
			return getRealmTagContextSummary(
				params.realmId,
				params.unitId,
				params.tagId,
				profile.unitId,
			);
		},
		{
			access: "contribute:interaction:write",
			params: RealmTagParams,
			body: RealmTagVoteBody,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmTagContextNotFound",
				]),
			},
			detail: { summary: "Vote on a Realm-scoped Unit Tag", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/units/:unitId/tags/:tagId/vote",
		async ({ params, profile, authorization }) => {
			await authorization.realm.ensureParticipation(params.realmId);
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
			]);
			await getRealmTagContextSummary(params.realmId, params.unitId, params.tagId);
			await database
				.delete(realmTagVote)
				.where(
					and(
						eq(realmTagVote.realmId, params.realmId),
						eq(realmTagVote.unitId, params.unitId),
						eq(realmTagVote.tagId, params.tagId),
						eq(realmTagVote.profileId, profile.unitId),
					),
				);
			return getRealmTagContextSummary(
				params.realmId,
				params.unitId,
				params.tagId,
				profile.unitId,
			);
		},
		{
			access: "contribute:interaction:write",
			params: RealmTagParams,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmTagContextNotFound",
				]),
			},
			detail: { summary: "Remove a Realm-scoped Unit Tag vote", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const items = await database
				.select({
					realmId: realmUnit.realmId,
					unitId: realmUnit.unitId,
					unitKind: unit.kind,
					language: resolvedUnitLocalizationLanguage(
						unit.id,
						query.localizationLanguages,
					),
					title: resolvedUnitLocalizationTitle(unit.id, query.localizationLanguages),
					status: realmUnit.status,
					postTargetingLocked: realmUnit.postTargetingLocked,
					moderationStatus: unit.moderationStatus,
					createdAt: realmUnit.createdAt,
					updatedAt: realmUnit.updatedAt,
				})
				.from(realmUnit)
				.innerJoin(unit, eq(unit.id, realmUnit.unitId))
				.where(
					and(
						eq(realmUnit.realmId, params.realmId),
						query.status ? eq(realmUnit.status, query.status) : undefined,
					),
				)
				.orderBy(
					sql`case ${realmUnit.status} when 'pending' then 0 when 'hidden' then 1 when 'removed' then 2 else 3 end`,
					desc(realmUnit.updatedAt),
					desc(realmUnit.unitId),
				)
				.limit(query.limit ?? 50);
			return {
				items: items.map((item) => {
					if (!item.language)
						throw new Error(`Realm Unit ${item.unitId} has no localization`);
					return { ...item, language: item.language };
				}),
			};
		},
		{
			access: "session-only",
			params: RealmParams,
			query: ListRealmUnitsQuery,
			response: {
				[StatusCodes.OK]: RealmUnitListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
			},
			detail: { summary: "List Realm Units for moderation", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units/:unitId/history",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const [target] = await database
				.select({ unitId: realmUnit.unitId })
				.from(realmUnit)
				.where(
					and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)),
				)
				.limit(1);
			if (!target) throw new RealmUnitNotFound();
			const actions = await database
				.select({
					id: moderationAction.id,
					caseId: moderationAction.caseId,
					kind: moderationAction.kind,
					actorProfileId: moderationAction.actorProfileId,
					actorName: primaryUnitTitle(profileTable.id),
					previousState: moderationAction.previousState,
					resultingState: moderationAction.resultingState,
					previousPostTargetingLocked: moderationAction.previousPostTargetingLocked,
					resultingPostTargetingLocked: moderationAction.resultingPostTargetingLocked,
					reasonCode: moderationAction.reasonCode,
					reversesActionId: moderationAction.reversesActionId,
					createdAt: moderationAction.createdAt,
				})
				.from(moderationAction)
				.innerJoin(moderationCase, eq(moderationCase.id, moderationAction.caseId))
				.leftJoin(profileTable, eq(profileTable.id, moderationAction.actorProfileId))
				.where(
					and(
						eq(moderationCase.authority, "realm"),
						eq(moderationCase.realmId, params.realmId),
						eq(moderationCase.targetKind, "realm_unit"),
						eq(moderationCase.targetId, params.unitId),
					),
				)
				.orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
				.limit(query.limit ?? 50);
			const actionIds = actions.map((action) => action.id);
			const notes = actionIds.length
				? await database.transaction((tx) =>
						listGovernanceNotes(tx, {
							subjectKind: "moderation_action",
							subjectIds: actionIds,
							roles: ["internal_note", "public_notice"],
						}),
					)
				: [];
			const notesByAction = new Map<
				string,
				Array<{
					postId: string;
					latestRevisionId: string | null;
					role: "internal_note" | "public_notice";
					language: "en" | "zh";
					content: ReturnType<typeof toPortableTextResponse>;
					createdAt: Date;
					updatedAt: Date;
				}>
			>();
			for (const note of notes) {
				if (note.role === "evidence") continue;
				const items = notesByAction.get(note.subjectId) ?? [];
				items.push({
					postId: note.postId,
					latestRevisionId: note.latestRevisionId,
					role: note.role,
					language: note.language,
					content: toPortableTextResponse(note.content),
					createdAt: note.createdAt,
					updatedAt: note.updatedAt,
				});
				notesByAction.set(note.subjectId, items);
			}
			return {
				items: actions.map((action) => ({
					...action,
					previousState: presentRealmUnitStatus(action.previousState),
					resultingState: presentRealmUnitStatus(action.resultingState),
					reasonCode: presentGovernanceReasonCode(action.reasonCode),
					notes: notesByAction.get(action.id) ?? [],
				})),
			};
		},
		{
			access: "session-only",
			params: RealmUnitParams,
			query: RealmUnitHistoryQuery,
			response: {
				[StatusCodes.OK]: RealmUnitModerationHistoryResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
			},
			detail: { summary: "Get Realm Unit moderation history", tags: ["Realms"] },
		},
	)
	.patch(
		"/:realmId/units/:unitId",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const result = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(concat(${params.realmId}, ':', ${params.unitId}), 0))`,
				);
				const [target] = await tx
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, params.unitId),
						),
					)
					.limit(1);
				if (!target) throw new RealmUnitNotFound();
				const [idempotentAction] = body.idempotencyKey
					? await tx
							.select({ caseId: moderationAction.caseId })
							.from(moderationAction)
							.innerJoin(
								moderationCase,
								eq(moderationCase.id, moderationAction.caseId),
							)
							.where(
								and(
									eq(moderationAction.actorProfileId, profile.unitId),
									eq(moderationAction.idempotencyKey, body.idempotencyKey),
									eq(moderationCase.authority, "realm"),
									eq(moderationCase.realmId, params.realmId),
									eq(moderationCase.targetKind, "realm_unit"),
									eq(moderationCase.targetId, params.unitId),
								),
							)
							.orderBy(desc(moderationAction.createdAt), desc(moderationAction.id))
							.limit(1)
					: [];
				let caseRow = idempotentAction
					? await loadModerationCaseForAction(tx, idempotentAction.caseId)
					: undefined;
				if (!caseRow) {
					const [candidate] = await tx
						.select({ id: moderationCase.id })
						.from(moderationCase)
						.where(
							and(
								eq(moderationCase.authority, "realm"),
								eq(moderationCase.realmId, params.realmId),
								eq(moderationCase.targetKind, "realm_unit"),
								eq(moderationCase.targetId, params.unitId),
								notInArray(moderationCase.state, [
									"resolved",
									"duplicate",
									"rejected",
								]),
							),
						)
						.orderBy(desc(moderationCase.updatedAt), desc(moderationCase.id))
						.limit(1);
					caseRow = candidate
						? await loadModerationCaseForAction(tx, candidate.id)
						: undefined;
				}
				if (!caseRow) {
					const [createdCase] = await tx
						.insert(moderationCase)
						.values({
							state: "reviewing",
							authority: "realm",
							realmId: params.realmId,
							targetKind: "realm_unit",
							targetId: params.unitId,
						})
						.returning();
					if (!createdCase)
						throw new Error("Realm moderation case insertion did not return a row");
					caseRow = createdCase;
				}
				const common = {
					caseId: caseRow.id,
					reasonCode: body.reasonCode,
					idempotencyKey: body.idempotencyKey,
				};
				const actionBody: CreateModerationActionBody =
					body.command === "note"
						? { ...common, kind: "note", notes: [body.annotation] }
						: {
								...common,
								kind: body.command,
								...(body.annotation ? { notes: [body.annotation] } : {}),
							};
				return executeAuthorizedModerationAction(tx, {
					caseRow,
					actorProfileId: profile.unitId,
					body: actionBody,
				});
			});
			return result.created;
		},
		{
			access: "contribute:unit:update",
			params: RealmUnitParams,
			body: ModerateRealmUnitBody,
			response: {
				[StatusCodes.OK]: ModerationActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ModerationActionIncompatible"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"ModerationTransitionInvalid",
					"ModerationActionNoEffect",
					"ModerationIdempotencyConflict",
					"PostTargetingLocked",
				]),
			},
			detail: { summary: "Apply Realm Unit moderation command", tags: ["Realms"] },
		},
	);
