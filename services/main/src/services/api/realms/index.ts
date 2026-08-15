import { DevelopmentPreviewCapability, RealmUnitCreatePermissionValues } from "@rezics/access";
import type { ContentLanguage } from "@rezics/i18n";
import { StatusCodes } from "http-status-codes";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { recordAuditEvent as appendAuditEvent } from "../../audit";
import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import { RealmRulesAcceptanceRequired } from "../../authorization/errors";
import { getUnitReadCondition } from "../../authorization/unit/query";
import {
	isRealmJoinable,
	isRealmVisible,
	type RealmCapability,
} from "../../authorization/realm/policy";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { ContentStructureSnapshotSchema } from "../../content-structure/contracts";
import { createContentStructureHistory } from "../../content-structure/history";
import { saveRealmTaxonomyDraft } from "../../content-structure/realm-taxonomy-draft";
import { fractionalPositionBetween } from "../../ordering/position";
import { decodeCursor, encodeCursor } from "../../pagination";
import {
	avatarReferenceFromColumns,
	firstUnitLocalizationTitle,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import {
	contentStructure,
	contentStructureNode,
	ActiveContentReviewCaseStateValues,
	contentGovernanceAction,
	governanceDecisionRule,
	contentReport,
	contentReportReferral,
	contentReviewCase,
	contentReviewCaseReportCounter,
	post,
	profile as profileTable,
	realm,
	realmStat,
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
	realmUnitTag,
	tag,
	unitFollow,
	unit,
	unitAccessGrant,
	unitOwnership,
	unitLocalization,
	unitRevisionHead,
} from "../../database/schema";
import { createGovernanceNotePost, listGovernanceNotes } from "../../governance/note-service";
import { createNotification } from "../../notifications/service";
import { findRealmMembership, getCurrentRealmRules } from "../../realms/service";
import { publishRealmRuleRevision } from "../../realms/rule-publication";
import { listRealmVotedTags } from "../../tags/service";
import { applyInitialTags } from "../../tags/initial-applications";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import { transitionUnitStatus } from "../../units/status";
import { toUnitVisibilityUpdate } from "../../units/visibility-update";
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
	RealmRulesAuthoringResponse,
	RealmRulesResponse,
	SavedResponse,
	ScoreContextResponse,
} from "../schema/action-response";
import {
	toApiErrorResponse,
	RealmDetailResponse,
	RealmListResponse,
	RealmTaxonomyResponse,
	SaveRealmTaxonomyDraftResponse,
	toPortableTextResponse,
} from "../schema/response";
import { contentReviewCaseAdvisoryLock } from "../reports/advisory-lock";
import {
	AcknowledgeRealmRulesBody,
	ApplyRealmPolicyTagBody,
	CreateRealmBody,
	CreateRealmTagContextBody,
	CreateRealmWikiBody,
	CreateRealmPinBody,
	ListRealmTagContextsQuery,
	ListRealmMembersQuery,
	ListRealmUnitsQuery,
	ListRealmsQuery,
	MoveRealmPinsBody,
	ModerateRealmUnitBody,
	ReviewRealmUnitBody,
	UpdateRealmRulesBody,
	RealmUnitParams,
	RealmTagContextParams,
	RealmTagVoteParams,
	PutRealmTagContextBody,
	RealmTagVoteBody,
	RealmTagContextResponse,
	RealmTagContextListResponse,
	RealmTagVotingResponse,
	RealmTagVoteResponse,
	RealmPolicyTagResponse,
	RealmUnitListResponse,
	RealmUnitModerationQuery,
	RealmUnitModerationResponse,
	RealmUnitHistoryQuery,
	RealmUnitModerationActionResponse,
	RealmUnitReviewResponse,
	RealmUnitModerationHistoryResponse,
	RealmMemberParams,
	RealmParams,
	RealmPinsQuery,
	RealmDetailQuery,
	RealmTaxonomyQuery,
	SaveRealmTaxonomyDraftBody,
	RealmRuleRevisionParams,
	RealmRulesQuery,
	SetRealmScoreContextBody,
	RealmPinParams,
	RemoveRealmPinQuery,
	RealmPagesResponse,
	UpdateRealmBody,
	UpdateRealmTagVotingBody,
	UpdateRealmPagesBody,
	UpdateRealmMemberBody,
} from "./schema";
import {
	decodeRealmUnitModerationCursor,
	encodeRealmUnitModerationCursor,
} from "./moderation-pagination";
import { requireCurrentRealmRuleRevision } from "./rule-acknowledgement";
import {
	executeAuthorizedContentGovernanceAction,
	loadContentReviewCaseForAction,
} from "../governance/content-governance-service";
import { getRealmUnitModerationCommands } from "../governance/content-governance-contract";
import { type CreateContentGovernanceActionBody } from "../governance/schema";
import { ContentGovernanceActionNoEffect as ModerationActionNoEffect } from "../governance/errors";
import {
	RealmScoreContextPostKindValues,
	RealmUnitStatusValues,
} from "../../database/schema/contract-values";
import {
	RealmUnitNotFound,
	RealmMemberNotFound,
	RealmMembershipNotFound,
	RealmNotFound,
	RealmOwnerLeaveForbidden,
	RealmRuleRevisionChanged,
	RealmScoreContextPostKindInvalid,
	RealmScoreContextPostNotMounted,
	RealmTagContextNotFound,
	RealmTagContextAlreadyExists,
	RealmTagContextPostAlreadyUsed,
	RealmTagContextPostNotMounted,
	RealmTagContextRequired,
	RealmTagSelfReferenceForbidden,
	RealmTagVotingDisabled,
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
import { createWikiPost } from "../../posts/wiki";
import { getContentStructureRevision } from "../../content-structure/service";
import { RealmUnitTagVoteListQuery, RealmUnitTagVoteListResponse } from "../tags/schema";
import { ValidationError } from "../errors";
import { RevisionContextBody } from "../schema";
import { planRealmPinMove } from "./pin-ordering";

const RealmNotFoundResponse = toApiErrorResponse(["RealmNotFound"]);
const RealmMutationNotFoundResponse = toApiErrorResponse(["RealmNotFound", "ImageAssetNotFound"]);
const RealmMutationForbiddenResponse = toApiErrorResponse(["RealmCapabilityRequired"]);
const RealmSlugMutationForbiddenResponse = toApiErrorResponse([
	"RealmCapabilityRequired",
	"PlatformCapabilityRequired",
]);

function presentRealmUnitStatus(value: string | null) {
	if (value === null) return null;
	const status = RealmUnitStatusValues.find((candidate) => candidate === value);
	if (!status) throw new Error("Realm moderation action has an invalid state outcome");
	return status;
}

function realmUnitModerationSelection(
	localizationLanguages: ListRealmUnitsQuery["localizationLanguages"],
) {
	return {
		realmId: realmUnit.realmId,
		unitId: realmUnit.unitId,
		unitKind: unit.kind,
		language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
		title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
		status: realmUnit.status,
		publicationState: realmUnit.publicationState,
		postTargetingLocked: realmUnit.postTargetingLocked,
		openReportCount: sql<number>`coalesce((
			select sum(${contentReviewCaseReportCounter.count})::int
			from ${contentReviewCase}
			inner join ${contentReviewCaseReportCounter}
				on ${contentReviewCaseReportCounter.caseId} = ${contentReviewCase.id}
			where ${contentReviewCase.authority} = 'realm'
				and ${contentReviewCase.realmId} = ${realmUnit.realmId}
				and ${contentReviewCase.targetUnitId} = ${realmUnit.unitId}
				and ${inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues)}
		), 0)`,
		moderationStatus: unit.moderationStatus,
		createdAt: realmUnit.createdAt,
		updatedAt: realmUnit.updatedAt,
	};
}

function presentRealmUnitModeration<
	Item extends {
		readonly language: ContentLanguage | null;
		readonly openReportCount: number;
		readonly postTargetingLocked: boolean;
		readonly status: (typeof RealmUnitStatusValues)[number];
		readonly unitId: string;
	},
>(item: Item) {
	if (!item.language) throw new Error(`Realm Unit ${item.unitId} has no localization`);
	return {
		...item,
		language: item.language,
		allowedCommands: [
			...getRealmUnitModerationCommands(
				item.status,
				item.postTargetingLocked,
				item.openReportCount > 0,
			),
		],
	};
}

async function ensureRealmFieldsAuthorized(
	authorization: Authorization<string>,
	realmId: string,
	capability: RealmCapability,
	_scope: readonly string[],
): Promise<void> {
	await authorization.realm.ensureCapability(realmId, capability);
}

async function ensureRealmVisible(realmId: string, request: Request) {
	const [record] = await database
		.select({ status: unit.status, visibility: unit.visibility })
		.from(realm)
		.innerJoin(unit, eq(unit.id, realm.id))
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new RealmNotFound();
	const identity = await resolveIdentity(request, "realm:read");
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
	const metadataRealmId = typeof metadata?.realmId === "string" ? metadata.realmId : subjectId;
	await appendAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: actorProfileId },
		authority: { kind: "realm", id: metadataRealmId },
		action,
		target: { kind: "unit", id: subjectId },
		details: metadata,
	});
}

function presentRealmTagVote(value: number | null): -1 | 1 | null {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Realm Tag vote has an invalid persisted value");
}

async function ensureRealmTagVoteEligibility(
	tx: DatabaseTransaction,
	input: {
		readonly realmId: string;
		readonly tagId: string;
		readonly viewerProfileId: string;
	},
) {
	await ensureRealmTagVotingEnabled(tx, input.realmId);

	const [context] = await tx
		.select({ tagId: realmTagContext.tagId })
		.from(realmTagContext)
		.innerJoin(
			realmUnit,
			and(
				eq(realmUnit.realmId, realmTagContext.realmId),
				eq(realmUnit.unitId, realmTagContext.contextPostId),
			),
		)
		.innerJoin(unit, eq(unit.id, realmTagContext.contextPostId))
		.where(
			and(
				eq(realmTagContext.realmId, input.realmId),
				eq(realmTagContext.tagId, input.tagId),
				eq(realmUnit.status, "visible"),
				eq(realmUnit.publicationState, "active"),
				getUnitReadCondition(input.viewerProfileId),
			),
		)
		.for("share")
		.limit(1);
	if (!context) throw new RealmTagContextRequired();
}

async function ensureRealmTagVotingEnabled(tx: DatabaseTransaction, realmId: string) {
	const [realmPolicy] = await tx
		.select({ enabled: realm.realmTagVotingEnabled })
		.from(realm)
		.where(eq(realm.id, realmId))
		.for("share")
		.limit(1);
	if (!realmPolicy) throw new RealmNotFound();
	if (!realmPolicy.enabled) throw new RealmTagVotingDisabled();
}

async function getRealmTagContextSummary(realmId: string, tagId: string) {
	const [record] = await database
		.select({
			realmId: realmTagContext.realmId,
			tagId: realmTagContext.tagId,
			contextPostId: realmTagContext.contextPostId,
			createdByProfileId: realmTagContext.createdByProfileId,
			createdAt: realmTagContext.createdAt,
			updatedAt: realmTagContext.updatedAt,
		})
		.from(realmTagContext)
		.where(and(eq(realmTagContext.realmId, realmId), eq(realmTagContext.tagId, tagId)))
		.limit(1);
	if (!record) throw new RealmTagContextNotFound();
	return record;
}

async function getRealmTagVoteSummary(
	realmId: string,
	unitId: string,
	tagId: string,
	profileId?: string,
) {
	const [[stat], [viewerVote]] = await Promise.all([
		database
			.select({
				score: realmTagVoteStat.score,
				voteCount: realmTagVoteStat.voteCount,
			})
			.from(realmTagVoteStat)
			.where(
				and(
					eq(realmTagVoteStat.realmId, realmId),
					eq(realmTagVoteStat.unitId, unitId),
					eq(realmTagVoteStat.tagId, tagId),
				),
			)
			.limit(1),
		profileId
			? database
					.select({ value: realmTagVote.value })
					.from(realmTagVote)
					.where(
						and(
							eq(realmTagVote.realmId, realmId),
							eq(realmTagVote.unitId, unitId),
							eq(realmTagVote.tagId, tagId),
							eq(realmTagVote.profileId, profileId),
						),
					)
					.limit(1)
			: Promise.resolve([]),
	]);
	return {
		realmId,
		unitId,
		tagId,
		value: presentRealmTagVote(viewerVote?.value ?? null),
		score: toSafeInteger(stat?.score ?? 0n, "Realm Tag vote score"),
		voteCount: toSafeInteger(stat?.voteCount ?? 0n, "Realm Tag vote count"),
	};
}

async function readRealmTaxonomy(
	tx: DatabaseTransaction,
	realmId: string,
	localizationLanguages: readonly ContentLanguage[],
	canReadUnit?: (unitId: string) => Promise<boolean>,
) {
	const [structure] = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, realmId),
				eq(contentStructure.kind, "realm.taxonomy"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) throw new RealmNotFound();
	const rows = await tx
		.select({
			id: contentStructureNode.id,
			parentId: contentStructureNode.parentId,
			contentUnitId: contentStructureNode.contentUnitId,
			unitKind: unit.kind,
			postKind: post.kind,
			language: unitLocalization.language,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			avatar: resolvedUnitLocalizationAvatar(
				contentStructureNode.contentUnitId,
				localizationLanguages,
			),
			position: contentStructureNode.position,
			queryStrategy: contentStructureNode.realmTagQueryStrategy,
		})
		.from(contentStructureNode)
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.innerJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
				eq(
					unitLocalization.language,
					resolvedUnitLocalizationLanguage(
						contentStructureNode.contentUnitId,
						localizationLanguages,
					),
				),
			),
		)
		.where(
			and(
				eq(contentStructureNode.structureId, structure.id),
				isNull(contentStructureNode.deletedAt),
			),
		)
		.orderBy(contentStructureNode.position, contentStructureNode.id);
	const readableRows = canReadUnit
		? (
				await Promise.all(
					rows.map(async (row) => ({
						row,
						readable: await canReadUnit(row.contentUnitId),
					})),
				)
			)
				.filter(({ readable }) => readable)
				.map(({ row }) => row)
		: rows;
	const tagIds = readableRows
		.filter((row) => row.unitKind === "tag")
		.map((row) => row.contentUnitId);
	const contexts = tagIds.length
		? await tx
				.select({
					tagId: realmTagContext.tagId,
					contextPostId: realmTagContext.contextPostId,
					contextSummary: resolvedUnitLocalizationSummary(
						realmTagContext.contextPostId,
						localizationLanguages,
					),
				})
				.from(realmTagContext)
				.innerJoin(
					realmUnit,
					and(
						eq(realmUnit.realmId, realmTagContext.realmId),
						eq(realmUnit.unitId, realmTagContext.contextPostId),
						eq(realmUnit.status, "visible"),
						eq(realmUnit.publicationState, "active"),
					),
				)
				.where(and(eq(realmTagContext.realmId, realmId), inArray(realmTagContext.tagId, tagIds)))
		: [];
	const readableContexts = canReadUnit
		? (
				await Promise.all(
					contexts.map(async (context) => ({
						context,
						readable: await canReadUnit(context.contextPostId),
					})),
				)
			)
				.filter(({ readable }) => readable)
				.map(({ context }) => context)
		: contexts;
	const contextByTagId = new Map(readableContexts.map((context) => [context.tagId, context]));
	const latestRevisionId = await getContentStructureRevision(tx, realmId, structure.id);
	if (!latestRevisionId) throw new Error("Realm taxonomy has no Content Structure revision");
	return {
		structureId: structure.id,
		latestRevisionId,
		items: readableRows.map((row) => {
			const contentKind =
				row.unitKind === "tag"
					? ("tag" as const)
					: row.unitKind === "label"
						? ("label" as const)
						: row.unitKind === "post" && row.postKind === "wiki"
							? ("wiki" as const)
							: null;
			if (!contentKind) throw new Error(`Invalid Realm taxonomy node ${row.id}`);
			const context = contextByTagId.get(row.contentUnitId);
			return {
				id: row.id,
				parentId: row.parentId,
				contentUnitId: row.contentUnitId,
				contentKind,
				language: row.language,
				title: row.title,
				summary: row.summary,
				avatar: presentAvatar(row.avatar),
				position: row.position,
				queryStrategy: row.queryStrategy,
				contextPostId: context?.contextPostId ?? null,
				contextSummary: context?.contextSummary ?? null,
			};
		}),
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
					memberCount: realmStat.activeMemberCount,
					language: unitLocalization.language,
					title: unitLocalization.title,
					summary: unitLocalization.summary,
					avatar: resolvedUnitLocalizationAvatar(unit.id, localizationLanguages),
					bannerAssetId: resolvedUnitLocalizationImageAssetId(
						unit.id,
						"banner",
						localizationLanguages,
					),
					coverAssetId: resolvedUnitLocalizationImageAssetId(
						unit.id,
						"cover",
						localizationLanguages,
					),
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.leftJoin(realmStat, eq(realmStat.realmId, realm.id))
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
			const slugAddresses = await getPublicCanonicalUnitSlugAddresses(items.map((item) => item.id));
			return {
				items: items.map(({ avatar, bannerAssetId, coverAssetId, ...item }) => ({
					...item,
					memberCount: toSafeInteger(item.memberCount ?? 0n, "Realm active member count"),
					slugAddress: slugAddresses.get(item.id) ?? null,
					avatar: presentAvatar(avatar),
					banner: presentImageAsset(bannerAssetId, "banner"),
					cover: presentImageAsset(coverAssetId, "cover"),
				})),
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
					(["unit.read", "realm.contribute", ...RealmUnitCreatePermissionValues] as const).map(
						(permission) => ({
							unitId: created.id,
							subjectKind: "realm" as const,
							realmId: created.id,
							realmRelation: "member" as const,
							permission,
							scope: [],
							grantedByProfileId: profile.unitId,
						}),
					),
				);
				await tx.insert(unitFollow).values({
					followerProfileId: profile.unitId,
					unitId: created.id,
				});
				await applyInitialTags(tx, {
					unitId: created.id,
					profileId: profile.unitId,
					tagIds: body.initialTagIds ?? [],
				});
				const taxonomySnapshot = ContentStructureSnapshotSchema.parse({
					version: 1,
					structure: taxonomy,
					nodes: [],
				});
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
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
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ImageAssetNotFound", "TagNotFound"]),
			},
			detail: { summary: "Create Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/slug-address",
		async ({ params, authorization, body }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
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
				[StatusCodes.FORBIDDEN]: RealmSlugMutationForbiddenResponse,
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
					"Development preview. Assigns or renames a Realm's optional public slug in the permanent realms namespace. The former address is retained as a redirect.",
				tags: ["Realms", "Slug Addresses"],
			},
		},
	)
	.get(
		"/:realmId",
		async ({ params, query, request }) => {
			const localizationLanguages = query.localizationLanguages ?? [];
			const { profile: viewer, authorization } = await ensureRealmVisible(params.realmId, request);
			const [record] = await database
				.select({
					id: realm.id,
					status: unit.status,
					visibility: unit.visibility,
					joinPolicy: realm.joinPolicy,
					realmTagVotingEnabled: realm.realmTagVotingEnabled,
					pages: realm.enabledPages,
					latestRevisionId: unitRevisionHead.revisionId,
					memberCount: realmStat.activeMemberCount,
					createdAt: unit.createdAt,
					updatedAt: unit.updatedAt,
				})
				.from(realm)
				.innerJoin(unit, eq(unit.id, realm.id))
				.innerJoin(unitRevisionHead, eq(unitRevisionHead.unitId, realm.id))
				.leftJoin(realmStat, eq(realmStat.realmId, realm.id))
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
				.where(and(eq(unitOwnership.unitId, params.realmId), isNull(unitOwnership.revokedAt)))
				.limit(1);
			const [realmCapabilities, accessDecision, historyDecision] = await Promise.all([
				authorization.realm.decideCapabilities(params.realmId, [
					"realm.units.create",
					"realm.post.replies.create",
					"realm.settings.update",
					"realm.members.read",
					"realm.members.manage",
					"realm.rules.update",
					"realm.pins.manage",
					"realm.tags.manage",
					"realm.tag-voting.update",
					"realm.tag-contexts.manage",
					"realm.units.moderate",
				]),
				authorization.unit.decide(params.realmId, "unit.access.manage"),
				authorization.unit.decide(params.realmId, "unit.history.restore"),
			]);
			const realmRecord = {
				...record,
				memberCount: toSafeInteger(record.memberCount ?? 0n, "Realm active member count"),
			};
			return {
				...realmRecord,
				slugAddress: await getPublicCanonicalUnitSlugAddress(record.id),
				language: selectedLocalization.language,
				avatar: presentAvatar(
					resolveUnitLocalizationAvatarFromOrdered(localizations, localizationLanguages),
				),
				banner: presentImageAsset(
					resolveUnitLocalizationImageAssetIdFromOrdered(
						localizations,
						"banner",
						localizationLanguages,
					),
					"banner",
				),
				cover: presentImageAsset(
					resolveUnitLocalizationImageAssetIdFromOrdered(
						localizations,
						"cover",
						localizationLanguages,
					),
					"cover",
				),
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
					canCreateUnits: realmCapabilities.get("realm.units.create") ?? false,
					canCreateReplies: realmCapabilities.get("realm.post.replies.create") ?? false,
					canUpdateSettings: realmCapabilities.get("realm.settings.update") ?? false,
					canReadMembers: realmCapabilities.get("realm.members.read") ?? false,
					canManageMembers: realmCapabilities.get("realm.members.manage") ?? false,
					canUpdateRules: realmCapabilities.get("realm.rules.update") ?? false,
					canManagePins: realmCapabilities.get("realm.pins.manage") ?? false,
					canManageTags: realmCapabilities.get("realm.tags.manage") ?? false,
					canUpdateTagVoting: realmCapabilities.get("realm.tag-voting.update") ?? false,
					canManageTagContexts: realmCapabilities.get("realm.tag-contexts.manage") ?? false,
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
	.put(
		"/:realmId/pages",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			const latestRevisionId = await database.transaction(async (tx) => {
				const updated = await tx
					.update(realm)
					.set({ enabledPages: [...body.pages], updatedAt: new Date() })
					.where(eq(realm.id, params.realmId))
					.returning({ id: realm.id });
				if (!updated.length) throw new RealmNotFound();
				const revision = await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					event: "update",
					baseRevisionId: body.baseRevisionId,
				});
				await recordAuditEvent(tx, profile.unitId, "realm.settings.update", params.realmId, {
					fields: ["pages"],
				});
				return revision.revisionId;
			});
			return { pages: [...body.pages], latestRevisionId };
		},
		{
			access: "session-only",
			params: RealmParams,
			body: UpdateRealmPagesBody,
			response: {
				[StatusCodes.OK]: RealmPagesResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
			},
			detail: { summary: "Replace enabled Realm pages", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/taxonomy",
		async ({ params, query, request }) => {
			const { authorization } = await ensureRealmVisible(params.realmId, request);
			return database.transaction((tx) =>
				readRealmTaxonomy(tx, params.realmId, query.localizationLanguages ?? [], (unitId) =>
					authorization.unit.canRead(unitId),
				),
			);
		},
		{
			params: RealmParams,
			query: RealmTaxonomyQuery,
			response: {
				[StatusCodes.OK]: RealmTaxonomyResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get Realm taxonomy", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/taxonomy/draft",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
			return database.transaction((tx) =>
				readRealmTaxonomy(tx, params.realmId, query.localizationLanguages ?? []),
			);
		},
		{
			access: "contribute:realm:manage",
			params: RealmParams,
			query: RealmTaxonomyQuery,
			response: {
				[StatusCodes.OK]: RealmTaxonomyResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Get complete Realm taxonomy draft", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/taxonomy/draft",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
			const referencedUnitIds = body.nodes.flatMap((node) =>
				node.state === "new" && node.content.kind === "unit" ? [node.content.unitId] : [],
			);
			await authorization.unit.ensureCanReadMany(referencedUnitIds);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:realm-taxonomy-draft`}::text, 0))`,
				);
				const result = await saveRealmTaxonomyDraft(tx, {
					ownerUnitId: params.realmId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					nodes: body.nodes,
				});
				const saved = await readRealmTaxonomy(tx, params.realmId, []);
				return { ...saved, revisionCreated: result.revisionCreated };
			});
		},
		{
			access: "contribute:realm:manage",
			params: RealmParams,
			body: SaveRealmTaxonomyDraftBody,
			response: {
				[StatusCodes.OK]: SaveRealmTaxonomyDraftResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
			},
			detail: { summary: "Save complete Realm taxonomy draft", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/score-context",
		async ({ params, request }) => {
			const authorization = (await resolveIdentity(request, "unit:read")).authorization;
			await authorization.unit.ensureCanRead(params.realmId, () => new RealmNotFound());
			const [context] = await database
				.select({ contextPostId: realmScoreContext.contextPostId })
				.from(realmScoreContext)
				.innerJoin(
					realmUnit,
					and(
						eq(realmUnit.realmId, realmScoreContext.realmId),
						eq(realmUnit.unitId, realmScoreContext.contextPostId),
					),
				)
				.where(
					and(
						eq(realmScoreContext.realmId, params.realmId),
						eq(realmUnit.status, "visible"),
						eq(realmUnit.publicationState, "active"),
					),
				)
				.limit(1);
			if (context)
				await authorization.unit.ensureCanRead(context.contextPostId, () => new PostNotFound());
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
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:realm-score-context`}::text, 0))`,
				);
				const [candidate] = await tx
					.select({ kind: post.kind })
					.from(post)
					.where(eq(post.id, body.contextPostId))
					.limit(1);
				if (!candidate) throw new PostNotFound();
				if (!RealmScoreContextPostKindValues.some((kind) => kind === candidate.kind))
					throw new RealmScoreContextPostKindInvalid();
				const [mountedPost] = await tx
					.select({ id: realmUnit.unitId })
					.from(realmUnit)
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, body.contextPostId),
							eq(realmUnit.status, "visible"),
							eq(realmUnit.publicationState, "active"),
						),
					)
					.limit(1);
				if (!mountedPost) throw new RealmScoreContextPostNotMounted();
				const [current] = await tx
					.select({ contextPostId: realmScoreContext.contextPostId })
					.from(realmScoreContext)
					.where(eq(realmScoreContext.realmId, params.realmId))
					.limit(1);
				if (current?.contextPostId === body.contextPostId) return;
				await tx
					.insert(realmScoreContext)
					.values({
						realmId: params.realmId,
						contextPostId: body.contextPostId,
					})
					.onConflictDoUpdate({
						target: realmScoreContext.realmId,
						set: { contextPostId: body.contextPostId, updatedAt: new Date() },
					});
				await recordAuditEvent(tx, profile.unitId, "realm.settings.update", params.realmId, {
					fields: ["scoreContextPostId"],
					operation: "set",
					previousContextPostId: current?.contextPostId ?? null,
					contextPostId: body.contextPostId,
				});
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
					"RealmScoreContextPostKindInvalid",
					"RealmScoreContextPostNotMounted",
				]),
			},
			detail: { summary: "Set Realm Score context", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/score-context",
		async ({ params, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.settings.update");
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:realm-score-context`}::text, 0))`,
				);
				const [removed] = await tx
					.delete(realmScoreContext)
					.where(eq(realmScoreContext.realmId, params.realmId))
					.returning({ contextPostId: realmScoreContext.contextPostId });
				if (!removed) return;
				await recordAuditEvent(tx, profile.unitId, "realm.settings.update", params.realmId, {
					fields: ["scoreContextPostId"],
					operation: "clear",
					previousContextPostId: removed.contextPostId,
					contextPostId: null,
				});
			});
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
			const statusUpdateDecision = body.status
				? await authorization.unit.decide(params.realmId, "unit.status.update", ["unit"])
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
				const unitUpdate = toUnitVisibilityUpdate(body.visibility);
				if (unitUpdate) {
					const updated = await tx
						.update(unit)
						.set(unitUpdate)
						.where(and(eq(unit.id, params.realmId), eq(unit.kind, "realm")))
						.returning({ id: unit.id });
					if (!updated.length) throw new RealmNotFound();
				}
				if (body.joinPolicy)
					await tx
						.update(realm)
						.set({ joinPolicy: body.joinPolicy, updatedAt: new Date() })
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
				}
				const revision = await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					event: "update",
				});
				if (body.status)
					await transitionUnitStatus(tx, {
						unitId: params.realmId,
						toStatus: body.status,
						actor: { kind: "profile", profileId: profile.unitId },
						authorization: {
							kind: "interactive",
							statusUpdateAllowed: statusUpdateDecision?.allowed ?? false,
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
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmMutationNotFoundResponse,
			},
			detail: { summary: "Update Realm", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/tag-voting",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tag-voting.update");
			await database.transaction(async (tx) => {
				const updated = await tx
					.update(realm)
					.set({ realmTagVotingEnabled: body.enabled, updatedAt: new Date() })
					.where(eq(realm.id, params.realmId))
					.returning({ id: realm.id });
				if (!updated.length) throw new RealmNotFound();
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.tag-voting.update", params.realmId, {
					enabled: body.enabled,
				});
			});
			return { enabled: body.enabled };
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			body: UpdateRealmTagVotingBody,
			response: {
				[StatusCodes.OK]: RealmTagVotingResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "Update Realm Tag voting policy", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/membership",
		async ({ params, profile }) => {
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
						acknowledgementMode: realmRuleRevision.acknowledgementMode,
						requireOnJoin: realmRuleRevision.requireOnJoin,
					})
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId))
					.orderBy(desc(realmRuleRevision.version))
					.limit(1);
				const acceptsOnFollow = rules?.acknowledgementMode === "implicit_on_follow";
				if (rules?.requireOnJoin && !acceptsOnFollow) {
					const [existingAcceptance] = await tx
						.select({ revisionId: realmRuleAcceptance.revisionId })
						.from(realmRuleAcceptance)
						.where(
							and(
								eq(realmRuleAcceptance.revisionId, rules.id),
								eq(realmRuleAcceptance.profileId, profile.unitId),
							),
						)
						.limit(1);
					if (!existingAcceptance) throw new RealmRulesAcceptanceRequired({ revisionId: rules.id });
				}
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
				if (rules && acceptsOnFollow)
					await tx
						.insert(realmRuleAcceptance)
						.values({
							revisionId: rules.id,
							profileId: profile.unitId,
							language: null,
						})
						.onConflictDoNothing();
			});
			return { state };
		},
		{
			access: "contribute:interaction:write",
			params: RealmParams,
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
						and(eq(realmMember.realmId, params.realmId), eq(realmMember.profileId, profile.unitId)),
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
						and(eq(realmMember.realmId, params.realmId), eq(realmMember.profileId, profile.unitId)),
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
				.where(and(eq(unitOwnership.unitId, params.realmId), isNull(unitOwnership.revokedAt)))
				.limit(1);
			const members = await database
				.select({
					profileId: realmMember.profileId,
					language: resolvedUnitLocalizationLanguage(profileTable.id, query.localizationLanguages),
					name: resolvedUnitLocalizationTitle(profileTable.id, query.localizationLanguages),
					avatar: resolvedUnitLocalizationAvatar(profileTable.id, query.localizationLanguages),
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
				if (targetOwnership && body.state !== "active") throw new RealmOwnerLeaveForbidden();
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
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.rules.update", [
				"rules",
			]);
			const revision = await database.transaction(async (tx) => {
				const result = await publishRealmRuleRevision(tx, {
					realmId: params.realmId,
					actorProfileId: profile.unitId,
					baseRevisionId: body.baseRevisionId,
					acknowledgementMode: body.acknowledgementMode,
					requireOnJoin: body.requireOnJoin,
					requireOnPost: body.requireOnPost,
					rules: body.rules,
					contribution: body.revisionContext?.contribution,
				});
				if (result.status === "revision_changed")
					throw new RealmRuleRevisionChanged({
						currentRevisionId: result.currentRevisionId,
					});
				if (result.status === "duplicate_localization")
					throw new ValidationError({
						path: `rules.${result.ruleIndex}.localizations`,
						reason: "duplicate_language",
					});
				await recordAuditEvent(tx, profile.unitId, "realm.rules.update", params.realmId);
				return result.revision;
			});
			return { id: revision.id, version: revision.version };
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			body: UpdateRealmRulesBody,
			response: {
				[StatusCodes.OK]: RealmRuleRevisionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmRuleRevisionChanged"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
			},
			detail: { summary: "Update Realm rules", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/rules/authoring",
		async ({ params, authorization }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.rules.update", [
				"rules",
			]);
			const current = await getCurrentRealmRules(params.realmId);
			if (!current)
				return {
					revisionId: null,
					version: null,
					acknowledgementMode: "explicit",
					requireOnJoin: false,
					requireOnPost: false,
					items: [],
				};
			const rows = await database
				.select({
					id: realmRule.id,
					position: realmRule.position,
					language: unitLocalization.language,
					title: unitLocalization.title,
					content: unitLocalization.content,
				})
				.from(realmRule)
				.innerJoin(unitLocalization, eq(unitLocalization.unitId, realmRule.id))
				.where(eq(realmRule.revisionId, current.revisionId))
				.orderBy(
					realmRule.position,
					realmRule.id,
					unitLocalization.position,
					unitLocalization.language,
				);
			const itemsById = new Map<
				string,
				{
					id: string;
					position: number;
					localizations: Array<{
						language: ContentLanguage;
						title: string;
						content: ReturnType<typeof toPortableTextResponse>;
					}>;
				}
			>();
			for (const row of rows) {
				if (!row.title) throw new Error(`Realm rule ${row.id} has no localized title`);
				const localization = {
					language: row.language,
					title: row.title,
					content: toPortableTextResponse(row.content, "unit_localization.content"),
				};
				const item = itemsById.get(row.id);
				if (item) item.localizations.push(localization);
				else
					itemsById.set(row.id, {
						id: row.id,
						position: row.position,
						localizations: [localization],
					});
			}
			return { ...current, items: [...itemsById.values()] };
		},
		{
			access: "write:realm:manage",
			params: RealmParams,
			response: {
				[StatusCodes.OK]: RealmRulesAuthoringResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: { summary: "Get Realm rules for authoring", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/rules",
		async ({ params, query, request }) => {
			await ensureRealmVisible(params.realmId, request);
			const current = await getCurrentRealmRules(params.realmId);
			if (!current)
				return {
					revisionId: null,
					version: null,
					acknowledgementMode: "explicit",
					requireOnJoin: false,
					requireOnPost: false,
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
							resolvedUnitLocalizationLanguage(realmRule.id, query.localizationLanguages),
						),
					),
				)
				.where(eq(realmRule.revisionId, current.revisionId))
				.orderBy(realmRule.position, realmRule.id);
			return {
				...current,
				items: items.map((item) => {
					if (!item.title) throw new Error(`Realm rule ${item.id} has no localized title`);
					return {
						...item,
						title: item.title,
						content: toPortableTextResponse(item.content, "unit_localization.content"),
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
	.put(
		"/:realmId/rules/:revisionId/acknowledgement",
		async ({ params, profile, body, request }) => {
			await ensureRealmVisible(params.realmId, request);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const [current] = await tx
					.select({ revisionId: realmRuleRevision.id })
					.from(realmRuleRevision)
					.where(eq(realmRuleRevision.realmId, params.realmId))
					.orderBy(desc(realmRuleRevision.version))
					.limit(1);
				const revisionId = requireCurrentRealmRuleRevision(params.revisionId, current?.revisionId);
				await tx
					.insert(realmRuleAcceptance)
					.values({
						revisionId,
						profileId: profile.unitId,
						language: body.language,
					})
					.onConflictDoNothing();
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "contribute:interaction:write",
			params: RealmRuleRevisionParams,
			body: AcknowledgeRealmRulesBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmRuleRevisionChanged"]),
			},
			detail: {
				summary: "Acknowledge current Realm rules",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/pins",
		async ({ params, query, request }) => {
			await ensureRealmVisible(params.realmId, request);
			const identity = await resolveIdentity(request, "unit:read");
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
			const viewer = await resolveRecommendationViewer(identity.authorization.profileId, false);
			const contentItems = await hydrateFeedItems(
				items.map((item) => ({
					id: item.unitId,
					realmId: params.realmId,
				})),
				viewer,
				{
					content: FeedContentKindValues,
					localizationLanguages: query.localizationLanguages ?? [],
				},
				new Date(),
				{ kind: "contextual" },
			);
			const visibleUnitIds = new Set(contentItems.map((item) => item.id));
			return {
				items: items.filter((item) => visibleUnitIds.has(item.unitId)),
				contentItems,
			};
		},
		{
			params: RealmParams,
			query: RealmPinsQuery,
			response: {
				[StatusCodes.OK]: RealmPinListResponse,
				[StatusCodes.NOT_FOUND]: RealmNotFoundResponse,
			},
			detail: { summary: "List Realm pins", tags: ["Realms"] },
		},
	)
	.post(
		"/:realmId/pins/move",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			const latestRevisionId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const pins = await tx
					.select({
						unitId: realmPin.unitId,
						kind: realmPin.kind,
						position: realmPin.position,
					})
					.from(realmPin)
					.where(eq(realmPin.realmId, params.realmId))
					.orderBy(realmPin.kind, realmPin.position, realmPin.unitId);
				const plan = planRealmPinMove(pins, body);
				if (!plan.ok) throw new ValidationError({ [plan.field]: plan.message });

				for (const planned of plan.positions)
					await tx
						.update(realmPin)
						.set({
							kind: planned.kind,
							position: planned.position,
						})
						.where(and(eq(realmPin.realmId, params.realmId), eq(realmPin.unitId, planned.unitId)));
				const revision = await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					event: "update",
				});
				await recordAuditEvent(tx, profile.unitId, "realm.pins.move", params.realmId, {
					unitIds: [...body.unitIds],
					destinationKind: body.destinationKind,
					placement: body.placement,
				});
				return revision.revisionId;
			});
			return { saved: true, latestRevisionId };
		},
		{
			access: "contribute:realm:manage",
			params: RealmParams,
			body: MoveRealmPinsBody,
			response: {
				[StatusCodes.OK]: SavedResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: { summary: "Move Realm pins", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, body }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			if (params.realmId === params.unitId)
				throw new ValidationError({ unitId: "a Realm cannot pin itself" });
			await authorization.unit.ensureCanRead(params.unitId);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
				const kind = body.kind ?? "pinned";
				const [existing] = await tx
					.select({
						realmId: realmPin.realmId,
						unitId: realmPin.unitId,
						kind: realmPin.kind,
						position: realmPin.position,
						createdAt: realmPin.createdAt,
						updatedAt: realmPin.updatedAt,
					})
					.from(realmPin)
					.where(and(eq(realmPin.realmId, params.realmId), eq(realmPin.unitId, params.unitId)))
					.limit(1);
				if (existing?.kind === kind) return existing;
				const [last] = await tx
					.select({ position: realmPin.position })
					.from(realmPin)
					.where(and(eq(realmPin.realmId, params.realmId), eq(realmPin.kind, kind)))
					.orderBy(desc(realmPin.position), desc(realmPin.unitId))
					.limit(1);
				const position = fractionalPositionBetween(last?.position, null);
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
						set: { kind, position },
					})
					.returning();
				if (!entry) throw new Error("Realm pin upsert did not return a row");
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
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
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ValidationError"]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Pin Realm unit", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/pins/:unitId",
		async ({ params, profile, authorization, query, body }) => {
			await ensureRealmFieldsAuthorized(authorization, params.realmId, "realm.pins.manage", [
				"pins",
			]);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${params.realmId}::text, 0))`,
				);
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
					contribution: body?.revisionContext?.contribution,
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
			body: t.Optional(RevisionContextBody),
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: {
				summary: "Remove Realm pin",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.post(
		"/:realmId/wikis",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureUnitCreation([params.realmId], "realm.units.create");
			if (body.subjectId) await authorization.unit.ensureCanRead(body.subjectId);
			const id = await database.transaction(async (tx) => {
				const created = await createWikiPost(tx, {
					profileId: profile.unitId,
					authorization,
					accessMode: body.accessMode ?? "community_owned",
					title: body.title,
					body: body.body,
					language: body.language,
					publishRealmIds: [params.realmId],
					governanceRealmId: params.realmId,
					...(body.subjectId ? { subjectId: body.subjectId } : {}),
				});
				return created.id;
			});
			return { id };
		},
		{
			access: "contribute:unit:create",
			params: RealmParams,
			body: CreateRealmWikiBody,
			response: {
				[StatusCodes.OK]: IdResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"EntityAssociationRestricted",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"RealmRulesAcceptanceRequired",
					"PostTargetingLocked",
				]),
			},
			detail: { summary: "Create Realm-governed Wiki", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/tag-contexts",
		async ({ params, query, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tag-contexts.manage");
			const localizationLanguages = query.localizationLanguages ?? [];
			const limit = query.limit ?? 50;
			const cursor = decodeCursor(query.cursor);
			const rows = await database
				.select({
					realmId: realmTagContext.realmId,
					tagId: realmTagContext.tagId,
					contextPostId: realmTagContext.contextPostId,
					createdByProfileId: realmTagContext.createdByProfileId,
					createdAt: realmTagContext.createdAt,
					updatedAt: realmTagContext.updatedAt,
					tagLanguage: resolvedUnitLocalizationLanguage(
						realmTagContext.tagId,
						localizationLanguages,
					),
					tagTitle: resolvedUnitLocalizationTitle(realmTagContext.tagId, localizationLanguages),
					contextLanguage: resolvedUnitLocalizationLanguage(
						realmTagContext.contextPostId,
						localizationLanguages,
					),
					contextTitle: resolvedUnitLocalizationTitle(
						realmTagContext.contextPostId,
						localizationLanguages,
					),
				})
				.from(realmTagContext)
				.where(
					and(
						eq(realmTagContext.realmId, params.realmId),
						cursor
							? or(
									lt(realmTagContext.updatedAt, new Date(cursor[0])),
									and(
										eq(realmTagContext.updatedAt, new Date(cursor[0])),
										lt(realmTagContext.tagId, cursor[1]),
									),
								)
							: undefined,
					),
				)
				.orderBy(desc(realmTagContext.updatedAt), desc(realmTagContext.tagId))
				.limit(limit + 1);
			const page = rows.slice(0, limit);
			const referencedUnitIds = [...new Set(page.flatMap((row) => [row.tagId, row.contextPostId]))];
			const readableUnitIds = referencedUnitIds.length
				? new Set(
						(
							await database
								.select({ id: unit.id })
								.from(unit)
								.where(
									and(inArray(unit.id, referencedUnitIds), getUnitReadCondition(profile.unitId)),
								)
						).map((row) => row.id),
					)
				: new Set<string>();
			const items = page.map((row) => {
				const tagReadable = readableUnitIds.has(row.tagId);
				const contextReadable = readableUnitIds.has(row.contextPostId);
				return {
					...row,
					tagReadable,
					tagLanguage: tagReadable ? row.tagLanguage : null,
					tagTitle: tagReadable ? row.tagTitle : null,
					contextReadable,
					contextLanguage: contextReadable ? row.contextLanguage : null,
					contextTitle: contextReadable ? row.contextTitle : null,
				};
			});
			const last = page.at(-1);
			return {
				items,
				nextCursor: rows.length > limit && last ? encodeCursor(last.updatedAt, last.tagId) : null,
			};
		},
		{
			access: "session-only",
			params: RealmParams,
			query: ListRealmTagContextsQuery,
			response: {
				[StatusCodes.OK]: RealmTagContextListResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: { summary: "List Realm Tag Context relationships", tags: ["Realms"] },
		},
	)
	.post(
		"/:realmId/tag-contexts",
		async ({ params, body, profile, authorization }) => {
			await Promise.all([
				authorization.realm.ensureCapability(params.realmId, "realm.tag-contexts.manage"),
				authorization.realm.ensureUnitCreation([params.realmId], "realm.units.create"),
				authorization.unit.ensureCanRead(body.tagId),
			]);
			const contextPostId = await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:${body.tagId}:realm-tag-context`}::text, 0))`,
				);
				await ensureRealmTagVotingEnabled(tx, params.realmId);
				const [existing] = await tx
					.select({ contextPostId: realmTagContext.contextPostId })
					.from(realmTagContext)
					.where(
						and(eq(realmTagContext.realmId, params.realmId), eq(realmTagContext.tagId, body.tagId)),
					)
					.limit(1);
				if (existing) throw new RealmTagContextAlreadyExists(existing);
				const [tagRecord] = await tx
					.select({ id: tag.id })
					.from(tag)
					.where(eq(tag.id, body.tagId))
					.limit(1);
				if (!tagRecord) throw new UnitNotFound("Tag");
				const created = await createWikiPost(tx, {
					profileId: profile.unitId,
					authorization,
					accessMode: body.accessMode ?? "community_owned",
					title: body.title,
					summary: body.summary,
					body: body.body,
					language: body.language,
					publishRealmIds: [params.realmId],
					governanceRealmId: params.realmId,
				});
				await tx.insert(realmTagContext).values({
					realmId: params.realmId,
					tagId: body.tagId,
					contextPostId: created.id,
					createdByProfileId: profile.unitId,
				});
				await recordAuditEvent(tx, profile.unitId, "realm.tag-contexts.create", body.tagId, {
					realmId: params.realmId,
					contextPostId: created.id,
				});
				return created.id;
			});
			const context = await getRealmTagContextSummary(params.realmId, body.tagId);
			if (context.contextPostId !== contextPostId)
				throw new Error("Created Realm Tag Context resolved to another Wiki Post");
			return context;
		},
		{
			access: "contribute:unit:create",
			params: RealmParams,
			body: CreateRealmTagContextBody,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"RealmTagContextAlreadyExists",
					"RealmRulesAcceptanceRequired",
					"PostTargetingLocked",
				]),
			},
			detail: { summary: "Create Realm Tag Context Wiki", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/tags/:tagId/context",
		async ({ params, request }) => {
			const { authorization } = await ensureRealmVisible(params.realmId, request);
			await authorization.unit.ensureCanRead(params.tagId);
			const record = await getRealmTagContextSummary(params.realmId, params.tagId);
			const [mounted] = await database
				.select({ unitId: realmUnit.unitId })
				.from(realmUnit)
				.where(
					and(
						eq(realmUnit.realmId, params.realmId),
						eq(realmUnit.unitId, record.contextPostId),
						eq(realmUnit.status, "visible"),
						eq(realmUnit.publicationState, "active"),
					),
				)
				.limit(1);
			if (!mounted) throw new RealmTagContextNotFound();
			await authorization.unit.ensureCanRead(record.contextPostId, () => new PostNotFound());
			return record;
		},
		{
			params: RealmTagContextParams,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"RealmNotFound",
					"PostNotFound",
					"RealmTagContextNotFound",
				]),
			},
			detail: { summary: "Get Realm Tag Context", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/tags/:tagId/context",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tag-contexts.manage");
			await Promise.all([
				authorization.unit.ensureCanRead(params.tagId),
				authorization.unit.ensureCanRead(body.contextPostId, () => new PostNotFound()),
			]);
			await database.transaction(async (tx) => {
				const lockKeys = [
					`${params.realmId}:${params.tagId}:realm-tag-context`,
					`${body.contextPostId}:realm-tag-context-post`,
				].sort();
				for (const lockKey of lockKeys)
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))`,
					);
				const [tagRecord] = await tx
					.select({ id: tag.id })
					.from(tag)
					.where(eq(tag.id, params.tagId))
					.limit(1);
				if (!tagRecord) throw new UnitNotFound("Tag");
				const [mounted] = await tx
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.innerJoin(post, eq(post.id, realmUnit.unitId))
					.where(
						and(
							eq(realmUnit.realmId, params.realmId),
							eq(realmUnit.unitId, body.contextPostId),
							eq(realmUnit.status, "visible"),
							eq(realmUnit.publicationState, "active"),
							eq(post.kind, "wiki"),
						),
					)
					.limit(1);
				if (!mounted) throw new RealmTagContextPostNotMounted();
				const [reused] = await tx
					.select({
						realmId: realmTagContext.realmId,
						tagId: realmTagContext.tagId,
					})
					.from(realmTagContext)
					.where(eq(realmTagContext.contextPostId, body.contextPostId))
					.limit(1);
				if (reused && (reused.realmId !== params.realmId || reused.tagId !== params.tagId))
					throw new RealmTagContextPostAlreadyUsed();
				await tx
					.insert(realmTagContext)
					.values({
						realmId: params.realmId,
						tagId: params.tagId,
						contextPostId: body.contextPostId,
						createdByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [realmTagContext.realmId, realmTagContext.tagId],
						set: {
							contextPostId: body.contextPostId,
							createdByProfileId: profile.unitId,
							updatedAt: new Date(),
						},
					});
				await recordAuditEvent(tx, profile.unitId, "realm.tag-contexts.update", params.tagId, {
					realmId: params.realmId,
					contextPostId: body.contextPostId,
				});
			});
			return getRealmTagContextSummary(params.realmId, params.tagId);
		},
		{
			access: "session-only",
			params: RealmTagContextParams,
			body: PutRealmTagContextBody,
			response: {
				[StatusCodes.OK]: RealmTagContextResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "PostNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmTagContextPostAlreadyUsed"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["RealmTagContextPostNotMounted"]),
			},
			detail: { summary: "Set Realm Tag Context", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/tags/:tagId/context",
		async ({ params, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tag-contexts.manage");
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:${params.tagId}:realm-tag-context`}::text, 0))`,
				);
				const [removed] = await tx
					.delete(realmTagContext)
					.where(
						and(
							eq(realmTagContext.realmId, params.realmId),
							eq(realmTagContext.tagId, params.tagId),
						),
					)
					.returning({ contextPostId: realmTagContext.contextPostId });
				if (!removed) throw new RealmTagContextNotFound();
				await recordAuditEvent(tx, profile.unitId, "realm.tag-contexts.delete", params.tagId, {
					realmId: params.realmId,
					contextPostId: removed.contextPostId,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "write:realm:manage",
			params: RealmTagContextParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmTagContextNotFound"]),
			},
			detail: {
				summary: "Remove Realm Tag Context relationship",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.put(
		"/:realmId/units/:unitId/policy-tags/:tagId",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
			if (params.unitId === params.tagId) throw new RealmTagSelfReferenceForbidden();
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
			]);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${params.realmId}:${params.unitId}:realm-policy-tags`}::text, 0))`,
				);
				const [[mounted], [tagRecord]] = await Promise.all([
					tx
						.select({ unitId: realmUnit.unitId })
						.from(realmUnit)
						.where(
							and(
								eq(realmUnit.realmId, params.realmId),
								eq(realmUnit.unitId, params.unitId),
								eq(realmUnit.status, "visible"),
								eq(realmUnit.publicationState, "active"),
							),
						)
						.limit(1),
					tx.select({ id: tag.id }).from(tag).where(eq(tag.id, params.tagId)).limit(1),
				]);
				if (!mounted) throw new RealmUnitNotFound();
				if (!tagRecord) throw new UnitNotFound("Tag");
				const [last] = body.position
					? []
					: await tx
							.select({ position: realmUnitTag.position })
							.from(realmUnitTag)
							.where(
								and(
									eq(realmUnitTag.realmId, params.realmId),
									eq(realmUnitTag.unitId, params.unitId),
								),
							)
							.orderBy(desc(realmUnitTag.position), desc(realmUnitTag.tagId))
							.limit(1);
				const position = body.position ?? fractionalPositionBetween(last?.position ?? null, null);
				const [record] = await tx
					.insert(realmUnitTag)
					.values({
						realmId: params.realmId,
						unitId: params.unitId,
						tagId: params.tagId,
						position,
						createdByProfileId: profile.unitId,
					})
					.onConflictDoUpdate({
						target: [realmUnitTag.realmId, realmUnitTag.unitId, realmUnitTag.tagId],
						set: { position, updatedAt: new Date() },
					})
					.returning();
				if (!record) throw new Error("Realm Policy Tag upsert returned no row");
				await recordAuditEvent(tx, profile.unitId, "realm.tags.policy.upsert", params.unitId, {
					realmId: params.realmId,
					tagId: params.tagId,
				});
				return record;
			});
		},
		{
			access: "session-only",
			params: RealmTagVoteParams,
			body: ApplyRealmPolicyTagBody,
			response: {
				[StatusCodes.OK]: RealmPolicyTagResponse,
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound", "UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["RealmTagSelfReferenceForbidden"]),
			},
			detail: { summary: "Apply Realm Policy Tag", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/units/:unitId/policy-tags/:tagId",
		async ({ params, profile, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.tags.manage");
			await database.transaction(async (tx) => {
				const deleted = await tx
					.delete(realmUnitTag)
					.where(
						and(
							eq(realmUnitTag.realmId, params.realmId),
							eq(realmUnitTag.unitId, params.unitId),
							eq(realmUnitTag.tagId, params.tagId),
						),
					)
					.returning({ tagId: realmUnitTag.tagId });
				if (deleted.length)
					await recordAuditEvent(tx, profile.unitId, "realm.tags.policy.delete", params.unitId, {
						realmId: params.realmId,
						tagId: params.tagId,
					});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "session-only",
			params: RealmTagVoteParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: RealmMutationForbiddenResponse,
			},
			detail: {
				summary: "Remove Realm Policy Tag",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	)
	.get(
		"/:realmId/units/:unitId/tags",
		async ({ params, profile, authorization, query }) => {
			await Promise.all([
				authorization.realm.ensureParticipation(params.realmId),
				authorization.unit.ensureCanRead(params.unitId),
			]);
			const tags = await listRealmVotedTags({
				unitId: params.unitId,
				viewerProfileId: profile.unitId,
				realmIds: [params.realmId],
				localizationLanguages: query.localizationLanguages,
				perRealmLimit: query.limit ?? 50,
			});
			return {
				realmId: params.realmId,
				tags: tags.get(params.realmId) ?? [],
			};
		},
		{
			access: "interaction:read",
			params: RealmUnitParams,
			query: RealmUnitTagVoteListQuery,
			response: {
				[StatusCodes.OK]: RealmUnitTagVoteListResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				summary: "List Realm-scoped Unit Tag votes",
				tags: ["Realms"],
			},
		},
	)
	.put(
		"/:realmId/units/:unitId/tags/:tagId/vote",
		async ({ params, body, profile, authorization }) => {
			await authorization.realm.ensureParticipation(params.realmId);
			if (params.unitId === params.tagId) throw new RealmTagSelfReferenceForbidden();
			await Promise.all([
				authorization.unit.ensureCanRead(params.unitId),
				authorization.unit.ensureCanRead(params.tagId),
			]);
			await database.transaction(async (tx) => {
				await ensureRealmTagVoteEligibility(tx, {
					realmId: params.realmId,
					tagId: params.tagId,
					viewerProfileId: profile.unitId,
				});
				await tx
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
			});
			return getRealmTagVoteSummary(params.realmId, params.unitId, params.tagId, profile.unitId);
		},
		{
			access: "contribute:interaction:write",
			params: RealmTagVoteParams,
			body: RealmTagVoteBody,
			response: {
				[StatusCodes.OK]: RealmTagVoteResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmTagVotingDisabled"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
					"RealmTagContextRequired",
					"RealmTagSelfReferenceForbidden",
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
			return getRealmTagVoteSummary(params.realmId, params.unitId, params.tagId, profile.unitId);
		},
		{
			access: "contribute:interaction:write",
			params: RealmTagVoteParams,
			response: {
				[StatusCodes.OK]: RealmTagVoteResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"RealmCapabilityRequired",
					"UnitAccessRestricted",
					"UnitPermissionForbidden",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Remove a Realm-scoped Unit Tag vote", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const limit = query.limit ?? 50;
			const statusFilter = query.status ?? "current";
			const publicationStateFilter = query.publicationState ?? "active";
			const cursor = decodeRealmUnitModerationCursor(query.cursor, {
				realmId: params.realmId,
				status: statusFilter,
				publicationState: publicationStateFilter,
				reported: query.reported,
			});
			const statusOrder = sql<number>`case ${realmUnit.status} when 'pending' then 0 when 'hidden' then 1 when 'removed' then 2 else 3 end`;
			const rows = await database
				.select(realmUnitModerationSelection(query.localizationLanguages))
				.from(realmUnit)
				.innerJoin(unit, eq(unit.id, realmUnit.unitId))
				.where(
					and(
						eq(realmUnit.realmId, params.realmId),
						statusFilter === "current"
							? inArray(realmUnit.status, ["pending", "visible", "hidden"])
							: statusFilter === "all"
								? undefined
								: eq(realmUnit.status, statusFilter),
						publicationStateFilter === "all"
							? undefined
							: eq(realmUnit.publicationState, publicationStateFilter),
						query.reported
							? sql`exists (
									select 1
									from ${contentReviewCase}
									inner join ${contentReportReferral}
										on ${contentReportReferral.caseId} = ${contentReviewCase.id}
									where ${contentReviewCase.authority} = 'realm'
										and ${contentReviewCase.realmId} = ${realmUnit.realmId}
										and ${contentReviewCase.targetUnitId} = ${realmUnit.unitId}
										and ${inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues)}
								)`
							: undefined,
						cursor
							? or(
									gt(statusOrder, cursor.statusOrder),
									and(
										eq(statusOrder, cursor.statusOrder),
										or(
											lt(realmUnit.updatedAt, cursor.updatedAt),
											and(
												eq(realmUnit.updatedAt, cursor.updatedAt),
												lt(realmUnit.unitId, cursor.unitId),
											),
										),
									),
								)
							: undefined,
					),
				)
				.orderBy(statusOrder, desc(realmUnit.updatedAt), desc(realmUnit.unitId))
				.limit(limit + 1);
			const hasMore = rows.length > limit;
			const page = rows.slice(0, limit);
			const items = page.map(presentRealmUnitModeration);
			const last = page.at(-1);
			return {
				items,
				nextCursor:
					hasMore && last
						? encodeRealmUnitModerationCursor(
								{
									realmId: params.realmId,
									status: statusFilter,
									publicationState: publicationStateFilter,
									reported: query.reported,
								},
								{
									status: last.status,
									updatedAt: last.updatedAt,
									unitId: last.unitId,
								},
							)
						: null,
			};
		},
		{
			access: "session-only",
			params: RealmParams,
			query: ListRealmUnitsQuery,
			response: {
				[StatusCodes.OK]: RealmUnitListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
			},
			detail: { summary: "List Realm Units for moderation", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units/:unitId",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const [item] = await database
				.select(realmUnitModerationSelection(query.localizationLanguages))
				.from(realmUnit)
				.innerJoin(unit, eq(unit.id, realmUnit.unitId))
				.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
				.limit(1);
			if (!item) throw new RealmUnitNotFound();
			return presentRealmUnitModeration(item);
		},
		{
			access: "session-only",
			params: RealmUnitParams,
			query: RealmUnitModerationQuery,
			response: {
				[StatusCodes.OK]: RealmUnitModerationResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
			},
			detail: { summary: "Get Realm Unit for moderation", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/units/:unitId/history",
		async ({ params, query, authorization }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const [target] = await database
				.select({ unitId: realmUnit.unitId })
				.from(realmUnit)
				.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
				.limit(1);
			if (!target) throw new RealmUnitNotFound();
			const actions = await database
				.select({
					id: contentGovernanceAction.id,
					decisionId: contentGovernanceAction.decisionId,
					caseId: contentGovernanceAction.caseId,
					kind: contentGovernanceAction.kind,
					actorProfileId: contentGovernanceAction.actorProfileId,
					actorName: firstUnitLocalizationTitle(profileTable.id),
					previousState: contentGovernanceAction.previousState,
					resultingState: contentGovernanceAction.resultingState,
					previousPostTargetingLocked: contentGovernanceAction.previousPostTargetingLocked,
					resultingPostTargetingLocked: contentGovernanceAction.resultingPostTargetingLocked,
					reversesActionId: contentGovernanceAction.reversesActionId,
					createdAt: contentGovernanceAction.createdAt,
				})
				.from(contentGovernanceAction)
				.innerJoin(contentReviewCase, eq(contentReviewCase.id, contentGovernanceAction.caseId))
				.leftJoin(profileTable, eq(profileTable.id, contentGovernanceAction.actorProfileId))
				.where(
					and(
						eq(contentReviewCase.authority, "realm"),
						eq(contentReviewCase.realmId, params.realmId),
						eq(contentReviewCase.targetUnitId, params.unitId),
					),
				)
				.orderBy(desc(contentGovernanceAction.createdAt), desc(contentGovernanceAction.id))
				.limit(query.limit ?? 50);
			const actionIds = actions.map((action) => action.id);
			const actionIdByDecisionId = new Map(
				actions.flatMap((action) =>
					action.decisionId ? [[action.decisionId, action.id] as const] : [],
				),
			);
			const decisionIds = [...actionIdByDecisionId.keys()];
			const [notes, ruleRows] = actionIds.length
				? await Promise.all([
						database.transaction((tx) =>
							listGovernanceNotes(tx, {
								subjectKind: "content_governance_action",
								subjectIds: actionIds,
								roles: ["internal_note", "public_notice"],
							}),
						),
						database
							.select({
								decisionId: governanceDecisionRule.decisionId,
								sourceRealmId: governanceDecisionRule.ruleSourceRealmId,
								revisionId: governanceDecisionRule.ruleRevisionId,
								ruleId: governanceDecisionRule.ruleId,
							})
							.from(governanceDecisionRule)
							.where(inArray(governanceDecisionRule.decisionId, decisionIds))
							.orderBy(
								governanceDecisionRule.decisionId,
								governanceDecisionRule.ruleSourceRealmId,
								governanceDecisionRule.ruleId,
							),
					])
				: [[], []];
			const rulesByAction = new Map<
				string,
				Array<{ sourceRealmId: string; revisionId: string; ruleId: string }>
			>();
			for (const rule of ruleRows) {
				const actionId = actionIdByDecisionId.get(rule.decisionId);
				if (!actionId) continue;
				const items = rulesByAction.get(actionId) ?? [];
				items.push({
					sourceRealmId: rule.sourceRealmId,
					revisionId: rule.revisionId,
					ruleId: rule.ruleId,
				});
				rulesByAction.set(actionId, items);
			}
			const notesByAction = new Map<
				string,
				Array<{
					postId: string;
					latestRevisionId: string | null;
					role: "internal_note" | "public_notice";
					language: ContentLanguage;
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
					content: toPortableTextResponse(note.content, "post.body"),
					createdAt: note.createdAt,
					updatedAt: note.updatedAt,
				});
				notesByAction.set(note.subjectId, items);
			}
			return {
				items: actions.map(({ decisionId: _decisionId, ...action }) => ({
					...action,
					previousState: presentRealmUnitStatus(action.previousState),
					resultingState: presentRealmUnitStatus(action.resultingState),
					rules: rulesByAction.get(action.id) ?? [],
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
				await tx.execute(contentReviewCaseAdvisoryLock("realm", params.realmId, params.unitId));
				const [target] = await tx
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
					.limit(1);
				if (!target) throw new RealmUnitNotFound();
				const [idempotentAction] = body.idempotencyKey
					? await tx
							.select({ caseId: contentGovernanceAction.caseId })
							.from(contentGovernanceAction)
							.innerJoin(
								contentReviewCase,
								eq(contentReviewCase.id, contentGovernanceAction.caseId),
							)
							.where(
								and(
									eq(contentGovernanceAction.actorProfileId, profile.unitId),
									eq(contentGovernanceAction.idempotencyKey, body.idempotencyKey),
									eq(contentReviewCase.authority, "realm"),
									eq(contentReviewCase.realmId, params.realmId),
									eq(contentReviewCase.targetUnitId, params.unitId),
								),
							)
							.orderBy(desc(contentGovernanceAction.createdAt), desc(contentGovernanceAction.id))
							.limit(1)
					: [];
				let caseRow = idempotentAction
					? await loadContentReviewCaseForAction(tx, idempotentAction.caseId)
					: undefined;
				if (!caseRow) {
					const [candidate] = await tx
						.select({ id: contentReviewCase.id })
						.from(contentReviewCase)
						.where(
							and(
								eq(contentReviewCase.authority, "realm"),
								eq(contentReviewCase.realmId, params.realmId),
								eq(contentReviewCase.targetUnitId, params.unitId),
								inArray(contentReviewCase.state, [
									...ActiveContentReviewCaseStateValues,
									"actioned",
								]),
							),
						)
						.orderBy(desc(contentReviewCase.updatedAt), desc(contentReviewCase.id))
						.limit(1);
					caseRow = candidate ? await loadContentReviewCaseForAction(tx, candidate.id) : undefined;
				}
				if (!caseRow) {
					const [createdCase] = await tx
						.insert(contentReviewCase)
						.values({
							state: "reviewing",
							authority: "realm",
							realmId: params.realmId,
							targetUnitId: params.unitId,
						})
						.returning();
					if (!createdCase)
						throw new Error("Realm content review case insertion did not return a row");
					caseRow = createdCase;
				}
				const common = {
					caseId: caseRow.id,
					idempotencyKey: body.idempotencyKey,
					revisionContext: body.revisionContext,
					...(body.annotation ? { notes: [body.annotation] } : {}),
				};
				const actionBody: CreateContentGovernanceActionBody = {
					...common,
					kind: body.command,
					rules: body.rules,
				};
				const executed = await executeAuthorizedContentGovernanceAction(tx, {
					caseRow,
					actorProfileId: profile.unitId,
					body: actionBody,
				});
				const [updatedTarget] = await tx
					.select({
						status: realmUnit.status,
						publicationState: realmUnit.publicationState,
						postTargetingLocked: realmUnit.postTargetingLocked,
						openReportCount: sql<number>`coalesce((
							select sum(${contentReviewCaseReportCounter.count})::int
							from ${contentReviewCase}
							inner join ${contentReviewCaseReportCounter}
								on ${contentReviewCaseReportCounter.caseId} = ${contentReviewCase.id}
							where ${contentReviewCase.authority} = 'realm'
								and ${contentReviewCase.realmId} = ${realmUnit.realmId}
								and ${contentReviewCase.targetUnitId} = ${realmUnit.unitId}
								and ${inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues)}
						), 0)`,
						updatedAt: realmUnit.updatedAt,
					})
					.from(realmUnit)
					.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
					.limit(1);
				if (!updatedTarget) throw new RealmUnitNotFound();
				return { action: executed.created, target: updatedTarget };
			});
			return {
				...result.action,
				target: {
					...result.target,
					allowedCommands: [
						...getRealmUnitModerationCommands(
							result.target.status,
							result.target.postTargetingLocked,
							result.target.openReportCount > 0,
						),
					],
				},
			};
		},
		{
			access: "contribute:unit:update",
			params: RealmUnitParams,
			body: ModerateRealmUnitBody,
			response: {
				[StatusCodes.OK]: RealmUnitModerationActionResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"ContentGovernanceActionIncompatible",
					"GovernanceRuleSourceForbidden",
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"ContentGovernanceTransitionInvalid",
					"ContentGovernanceActionNoEffect",
					"ContentGovernanceIdempotencyConflict",
					"GovernanceRuleChanged",
					"PostTargetingLocked",
				]),
			},
			detail: { summary: "Apply a Realm content governance action", tags: ["Realms"] },
		},
	)
	.post(
		"/:realmId/units/:unitId/review",
		async ({ params, profile, authorization, body }) => {
			await authorization.realm.ensureCapability(params.realmId, "realm.units.moderate");
			const result = await database.transaction(async (tx) => {
				await tx.execute(contentReviewCaseAdvisoryLock("realm", params.realmId, params.unitId));
				const [target] = await tx
					.select({ unitId: realmUnit.unitId })
					.from(realmUnit)
					.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
					.limit(1);
				if (!target) throw new RealmUnitNotFound();
				let [caseRow] = await tx
					.select()
					.from(contentReviewCase)
					.where(
						and(
							eq(contentReviewCase.authority, "realm"),
							eq(contentReviewCase.realmId, params.realmId),
							eq(contentReviewCase.targetUnitId, params.unitId),
							inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues),
							body.command === "dismiss"
								? sql`exists (
									select 1 from ${contentReportReferral}
									where ${contentReportReferral.caseId} = ${contentReviewCase.id}
								)`
								: undefined,
						),
					)
					.orderBy(desc(contentReviewCase.updatedAt), desc(contentReviewCase.id))
					.for("update")
					.limit(1);
				if (!caseRow && body.command === "dismiss") throw new ModerationActionNoEffect();
				if (!caseRow) {
					[caseRow] = await tx
						.insert(contentReviewCase)
						.values({
							state: "reviewing",
							authority: "realm",
							realmId: params.realmId,
							targetUnitId: params.unitId,
						})
						.returning();
				}
				if (!caseRow) throw new Error("Realm content review case insertion returned no row");
				const reportRows = await tx
					.select({
						referralId: contentReportReferral.id,
						reportId: contentReport.id,
						reporterProfileId: contentReport.reporterProfileId,
					})
					.from(contentReportReferral)
					.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
					.where(eq(contentReportReferral.caseId, caseRow.id));
				const annotation = body.annotation
					? await createGovernanceNotePost(tx, {
							actorProfileId: profile.unitId,
							subjectKind: "content_review_case",
							subjectId: caseRow.id,
							subjectUnitId: params.unitId,
							realmId: params.realmId,
							publicRecipientProfileIds: [
								...new Set(reportRows.map((report) => report.reporterProfileId)),
							],
							revisionContribution: body.revisionContext?.contribution,
							note: body.annotation,
						})
					: undefined;
				const caseState = body.command === "dismiss" ? ("rejected" as const) : caseRow.state;
				if (body.command === "dismiss") {
					await tx
						.update(contentReviewCase)
						.set({ state: caseState })
						.where(eq(contentReviewCase.id, caseRow.id));
					for (const report of reportRows)
						await createNotification(tx, {
							recipientProfileId: report.reporterProfileId,
							actorProfileId: profile.unitId,
							kind: "moderation",
							subjectUnitId: params.unitId,
							payload: {
								type: "report_resolution",
								reportId: report.reportId,
								referralId: report.referralId,
								resolution: "dismissed",
								publicNoticePostId:
									body.annotation?.role === "public_notice" ? annotation?.postId : undefined,
							},
						});
				}
				await appendAuditEvent(tx, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: { kind: "profile", profileId: profile.unitId },
					authority: { kind: "realm", id: params.realmId },
					action: `content_review.${body.command}`,
					target: { kind: "realm_unit", id: params.unitId },
					details: { caseId: caseRow.id, notePostId: annotation?.postId },
				});
				const [updatedTarget] = await tx
					.select({
						status: realmUnit.status,
						publicationState: realmUnit.publicationState,
						postTargetingLocked: realmUnit.postTargetingLocked,
						openReportCount: sql<number>`coalesce((
							select sum(${contentReviewCaseReportCounter.count})::int
							from ${contentReviewCase}
							inner join ${contentReviewCaseReportCounter}
								on ${contentReviewCaseReportCounter.caseId} = ${contentReviewCase.id}
							where ${contentReviewCase.authority} = 'realm'
								and ${contentReviewCase.realmId} = ${realmUnit.realmId}
								and ${contentReviewCase.targetUnitId} = ${realmUnit.unitId}
								and ${inArray(contentReviewCase.state, ActiveContentReviewCaseStateValues)}
						), 0)`,
						updatedAt: realmUnit.updatedAt,
					})
					.from(realmUnit)
					.where(and(eq(realmUnit.realmId, params.realmId), eq(realmUnit.unitId, params.unitId)))
					.limit(1);
				if (!updatedTarget) throw new RealmUnitNotFound();
				return { caseId: caseRow.id, caseState, target: updatedTarget };
			});
			return {
				...result,
				target: {
					...result.target,
					allowedCommands: [
						...getRealmUnitModerationCommands(
							result.target.status,
							result.target.postTargetingLocked,
							result.target.openReportCount > 0,
						),
					],
				},
			};
		},
		{
			access: "contribute:unit:update",
			params: RealmUnitParams,
			body: ReviewRealmUnitBody,
			response: {
				[StatusCodes.OK]: RealmUnitReviewResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmUnitNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentGovernanceActionNoEffect"]),
			},
			detail: { summary: "Update a Realm content review case", tags: ["Realms"] },
		},
	);
