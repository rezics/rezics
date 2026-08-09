import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";

import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { AuthenticationRequired } from "../../auth/errors";
import { getPlatformCapabilityCondition } from "../../authorization/platform/query";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { unitOwnershipModeFromOwnerProfileId } from "../../authorization/unit/ownership";
import { getUnitPermissionCondition } from "../../authorization/unit/query";
import { associationTargetScope, unitScope } from "../../authorization/unit/scope";
import { database } from "../../database";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
} from "../../units/localization";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	creditAttribution,
	entity,
	subjectAssociation,
	tag,
	unit,
	unitAlias,
	unitAliasVote,
	unitAliasVoteStat,
	unitOwnership,
	unitTagVote,
	unitExternalLink,
	unitExternalLinkVote,
	unitExternalLinkVoteStat,
	unitReferenceCurationHead,
	unitTag,
	unitTagVoteStat,
	unitLocalization,
} from "../../database/schema";
import {
	isCreditAttributionRoleForUnitKind,
	isEntityKind,
} from "../../database/schema/contract-values";
import {
	type UnitReferenceCurationKind,
	UnitReferenceActiveLimit,
	UnitReferencePageDefault,
} from "../../database/schema/contract-values";
import {
	AddUnitAliasBody,
	AddUnitCreditBody,
	AddUnitSubjectAssociationBody,
	AddUnitExternalLinkBody,
	AttributionAssociationParams,
	AttributionUnitParams,
	CreateUnitResourceBody,
	CreateEntityBody,
	EntityDetailQuery,
	EntityLocalizationParams,
	ListEntityEntriesQuery,
	ListTagsQuery,
	TagDetailParams,
	TagDetailQuery,
	TagLocalizationParams,
	TagUnitBody,
	UpdateUnitTagCurationBody,
	UpdateUnitReferenceCurationBody,
	WithdrawUnitReferenceQuery,
	UnitAssociationParams,
	UnitAliasListQuery,
	UnitAliasParams,
	UnitAliasUnitParams,
	UnitExternalLinkParams,
	UnitExternalLinkListQuery,
	UnitExternalLinkUnitParams,
	UnitUnitParams,
	UnitTagParams,
	VoteBody,
} from "./schema";
import { checkUnitType, createUnitResource } from "./service";
import { upsertLocalization } from "../../units/service";
import { UnitLocalizationBody } from "../units/schema";
import { recordUnitRevision } from "../../units/history";
import {
	ensureWikiAssociationContextPost,
	getAssociationContextPostsByAssociationIds,
} from "../../units/association-context";
import {
	getAttributionSummariesByUnitIds,
	getPublicUnitSummariesByIds,
} from "../../units/attribution";
import { ensureDirectCreditAttributionAllowed } from "../../units/attribution-authorization";
import { presentImageAsset } from "../../units/service";
import { presentAvatar } from "../../units/avatar";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { UnitIdParams } from "../schema";
import {
	toApiErrorResponse,
	AliasResponse,
	AliasCurationResponse,
	AliasListResponse,
	CreditAttributionResponse,
	EntityDetailResponse,
	EntityListResponse,
	SubjectAssociationResponse,
	TagApplicationResponse,
	TagDetailResponse,
	TagListResponse,
	toPortableTextResponse,
	UnitExternalLinkListResponse,
	UnitExternalLinkResponse,
	UnitExternalLinkCurationResponse,
	VoteResponse,
} from "../schema/response";
import {
	AliasNotFound,
	TagApplicationNotFound,
	UnitExternalLinkNotFound,
	UnitReferenceLimitReached,
	UnitReferenceWithdrawn,
} from "./errors";
import { TagNotFound } from "../tags/errors";
import {
	CreditAttributionNotFound,
	CreditAttributionRoleInvalid,
	EntityEntryNotFound,
	SubjectAssociationNotFound,
} from "../../entities/errors";
import { AssociationContextPostInvalid } from "../../units/errors";
import { updateDirectUnitTagCuration } from "../../tags/curation";
import { getPendingUnitOwnershipClaim } from "../../ownership-claims/service";
import { normalizeExternalWebUrl } from "./external-web-url";
import {
	ensureUnitReferenceCanBeCreated,
	updateUnitAliasCuration,
	updateUnitExternalLinkCuration,
	withdrawUnitAlias,
	withdrawUnitExternalLink,
} from "../../units/reference-curation";
import {
	paginateUnitReferences,
	unitReferenceRankingVersion,
} from "../../units/reference-pagination";
import { presentBinaryVoteSummary } from "../../votes/binary";
import {
	attachReadableSourceEntities,
	getUnitExternalLinkPreviewWithSources,
} from "../../units/external-links";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const UnitResourceMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"ImageAssetNotFound",
]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
]);
const UnitInteractionForbiddenResponse = toApiErrorResponse([
	"UnitAccessRestricted",
	"UnitPermissionForbidden",
]);
const publiclyReadableUnitCondition = () =>
	and(
		eq(unit.status, "published"),
		eq(unit.visibility, "public"),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
	);

function requireEntityKind(value: string) {
	if (!isEntityKind(value)) throw new Error("Persisted Entity kind is not supported");
	return value;
}

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await authorization.ensureCanUpdate(unitId, [scope]);
}

async function ensureReadableSourceEntity(
	authorization: UnitAuthorization<string>,
	sourceEntityId: string,
): Promise<void> {
	await authorization.ensureCanRead(sourceEntityId, () => new EntityEntryNotFound());
	const [sourceEntity] = await database
		.select({ id: entity.id })
		.from(entity)
		.where(eq(entity.id, sourceEntityId))
		.limit(1);
	if (!sourceEntity) throw new EntityEntryNotFound();
}

async function getAliasVoteSummary(aliasId: string, value: -1 | 1 | null) {
	const [totals] = await database
		.select({
			score: unitAliasVoteStat.score,
			voteCount: unitAliasVoteStat.voteCount,
			updatedAt: unitAliasVoteStat.updatedAt,
		})
		.from(unitAliasVoteStat)
		.where(eq(unitAliasVoteStat.aliasId, aliasId));
	return presentBinaryVoteSummary({
		score: totals?.score ?? 0n,
		voteCount: totals?.voteCount ?? 0n,
		viewerVote: value,
		updatedAt: totals?.updatedAt,
		name: "Alias",
	});
}

async function getExternalLinkVoteSummary(externalLinkId: string, value: -1 | 1 | null) {
	const [totals] = await database
		.select({
			score: unitExternalLinkVoteStat.score,
			voteCount: unitExternalLinkVoteStat.voteCount,
			updatedAt: unitExternalLinkVoteStat.updatedAt,
		})
		.from(unitExternalLinkVoteStat)
		.where(eq(unitExternalLinkVoteStat.externalLinkId, externalLinkId));
	return presentBinaryVoteSummary({
		score: totals?.score ?? 0n,
		voteCount: totals?.voteCount ?? 0n,
		viewerVote: value,
		updatedAt: totals?.updatedAt,
		name: "External link",
	});
}

async function getReferenceCurationVersion(
	unitId: string,
	kind: UnitReferenceCurationKind,
): Promise<number> {
	const [head] = await database
		.select({ version: unitReferenceCurationHead.version })
		.from(unitReferenceCurationHead)
		.where(
			and(
				eq(unitReferenceCurationHead.unitId, unitId),
				eq(unitReferenceCurationHead.kind, kind),
			),
		)
		.limit(1);
	return head?.version ?? 0;
}

function normalizeAliasTerm(term: string): string {
	return term.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

async function getAliasReference(aliasId: string, viewerProfileId: string) {
	const [row] = await database
		.select({
			id: unitAlias.id,
			unitId: unitAlias.unitId,
			term: unitAlias.term,
			normalizedTerm: unitAlias.normalizedTerm,
			language: unitAlias.language,
			kind: unitAlias.kind,
			createdByProfileId: unitAlias.createdByProfileId,
			viewerVote: unitAliasVote.value,
			score: unitAliasVoteStat.score,
			voteCount: unitAliasVoteStat.voteCount,
			voteUpdatedAt: unitAliasVoteStat.updatedAt,
			pinned: unitAlias.pinned,
			position: unitAlias.position,
			createdAt: unitAlias.createdAt,
			updatedAt: unitAlias.updatedAt,
		})
		.from(unitAlias)
		.leftJoin(unitAliasVoteStat, eq(unitAliasVoteStat.aliasId, unitAlias.id))
		.leftJoin(
			unitAliasVote,
			and(
				eq(unitAliasVote.aliasId, unitAlias.id),
				eq(unitAliasVote.profileId, viewerProfileId),
			),
		)
		.where(and(eq(unitAlias.id, aliasId), isNull(unitAlias.withdrawnAt)))
		.limit(1);
	if (!row) throw new AliasNotFound();
	const { viewerVote, score, voteCount, voteUpdatedAt, ...reference } = row;
	return {
		...reference,
		voteSummary: presentBinaryVoteSummary({
			score: score ?? 0n,
			voteCount: voteCount ?? 0n,
			viewerVote,
			updatedAt: voteUpdatedAt,
			name: "Alias",
		}),
	};
}

async function getExternalLinkReference(externalLinkId: string, viewerProfileId: string) {
	const [row] = await database
		.select({
			id: unitExternalLink.id,
			unitId: unitExternalLink.unitId,
			sourceEntityId: unitExternalLink.sourceEntityId,
			url: unitExternalLink.url,
			normalizedUrl: unitExternalLink.normalizedUrl,
			normalizedUrlHash: unitExternalLink.normalizedUrlHash,
			createdByProfileId: unitExternalLink.createdByProfileId,
			viewerVote: unitExternalLinkVote.value,
			score: unitExternalLinkVoteStat.score,
			voteCount: unitExternalLinkVoteStat.voteCount,
			voteUpdatedAt: unitExternalLinkVoteStat.updatedAt,
			pinned: unitExternalLink.pinned,
			position: unitExternalLink.position,
			createdAt: unitExternalLink.createdAt,
			updatedAt: unitExternalLink.updatedAt,
		})
		.from(unitExternalLink)
		.leftJoin(
			unitExternalLinkVoteStat,
			eq(unitExternalLinkVoteStat.externalLinkId, unitExternalLink.id),
		)
		.leftJoin(
			unitExternalLinkVote,
			and(
				eq(unitExternalLinkVote.externalLinkId, unitExternalLink.id),
				eq(unitExternalLinkVote.profileId, viewerProfileId),
			),
		)
		.where(and(eq(unitExternalLink.id, externalLinkId), isNull(unitExternalLink.withdrawnAt)))
		.limit(1);
	if (!row) throw new UnitExternalLinkNotFound();
	const { viewerVote, score, voteCount, voteUpdatedAt, ...reference } = row;
	return {
		...reference,
		voteSummary: presentBinaryVoteSummary({
			score: score ?? 0n,
			voteCount: voteCount ?? 0n,
			viewerVote,
			updatedAt: voteUpdatedAt,
			name: "External link",
		}),
	};
}

async function getTagVoteSummary(unitId: string, tagId: string, value: -1 | 1 | null) {
	const [totals] = await database
		.select({
			score: unitTagVoteStat.score,
			voteCount: unitTagVoteStat.voteCount,
			updatedAt: unitTagVoteStat.updatedAt,
		})
		.from(unitTagVoteStat)
		.where(and(eq(unitTagVoteStat.unitId, unitId), eq(unitTagVoteStat.tagId, tagId)));
	return presentBinaryVoteSummary({
		score: totals?.score ?? 0n,
		voteCount: totals?.voteCount ?? 0n,
		viewerVote: value,
		updatedAt: totals?.updatedAt,
		name: "Tag",
	});
}

export default new Elysia()
	.use(session)
	.group("/entities", (app) =>
		app
			.get(
				"",
				async ({ query, request }) => {
					const localizationLanguages = query.localizationLanguages ?? [];
					let entityCondition = publiclyReadableUnitCondition();
					if (query.creditAttributionSearch === "direct") {
						const identity = await resolveIdentity(request, "unit:read");
						if (!identity.profile) throw new AuthenticationRequired();
						const target = {
							id: unit.id,
							deletedAt: unit.deletedAt,
						};
						const scope = associationTargetScope("credit");
						entityCondition = and(
							eq(unit.status, "published"),
							inArray(unit.visibility, ["public", "unlisted"]),
							eq(unit.moderationStatus, "approved"),
							isNull(unit.deletedAt),
							or(
								getPlatformCapabilityCondition(
									identity.profile.unitId,
									"entity.associations.override",
								),
								getUnitPermissionCondition(
									identity.profile.unitId,
									"unit.association.manage",
									scope,
									target,
								),
								getUnitPermissionCondition(
									identity.profile.unitId,
									"entity.association.credit.direct",
									scope,
									target,
								),
							),
						);
					}
					const items = await database
						.select({
							id: unit.id,
							kind: entity.kind,
							verified: entity.verified,
							language: unitLocalization.language,
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
							title: unitLocalization.title,
							summary: unitLocalization.summary,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.innerJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								eq(
									unitLocalization.language,
									resolvedUnitLocalizationLanguage(
										unit.id,
										localizationLanguages,
									),
								),
							),
						)
						.where(
							and(
								entityCondition,
								query.kind ? eq(entity.kind, query.kind) : undefined,
								query.query
									? ilike(unitLocalization.title, `%${query.query}%`)
									: undefined,
							),
						)
						.orderBy(desc(unit.createdAt))
						.limit(query.limit ?? 20);
					return {
						items: items.map(
							({ avatar, bannerAssetId, coverAssetId, kind, ...item }) => ({
								...item,
								kind: requireEntityKind(kind),
								avatar: presentAvatar(avatar),
								banner: presentImageAsset(bannerAssetId, "banner"),
								cover: presentImageAsset(coverAssetId, "cover"),
							}),
						),
					};
				},
				{
					query: ListEntityEntriesQuery,
					response: {
						[StatusCodes.OK]: EntityListResponse,
						[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
					},
					detail: { summary: "List entity entries", tags: ["Entity"] },
				},
			)
			.post(
				"",
				async ({ profile, body }) => ({
					id: await createUnitResource("entity", profile.unitId, body),
				}),
				{
					access: "contribute:unit:create",
					body: CreateEntityBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
					},
					detail: { summary: "Create entity entry", tags: ["Entity"] },
				},
			)
			.get(
				"/:unitId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const localizationLanguages = query.localizationLanguages ?? [];
					const [entry] = await database
						.select({
							id: unit.id,
							kind: entity.kind,
							verified: entity.verified,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.where(and(eq(entity.id, params.unitId), publiclyReadableUnitCondition()))
						.limit(1);
					if (!entry) throw new EntityEntryNotFound();
					const storedLocalizations = await database
						.select()
						.from(unitLocalization)
						.where(eq(unitLocalization.unitId, params.unitId))
						.orderBy(asc(unitLocalization.position), asc(unitLocalization.language));
					const selectedLocalization = resolveUnitLocalizationFromOrdered(
						storedLocalizations,
						localizationLanguages,
					);
					if (!selectedLocalization) throw new EntityEntryNotFound();
					const attributions =
						(
							await getAttributionSummariesByUnitIds(
								[params.unitId],
								localizationLanguages,
							)
						).get(params.unitId) ?? [];
					const localizations = storedLocalizations.map((row) => ({
						unitId: row.unitId,
						language: row.language,
						position: row.position,
						title: row.title,
						summary: row.summary,
						description:
							row.description === null
								? null
								: toPortableTextResponse(
										row.description,
										"unit_localization.description",
									),
						avatar: presentAvatar(avatarReferenceFromColumns(row)),
						banner: presentImageAsset(row.bannerAssetId, "banner"),
						cover: presentImageAsset(row.coverAssetId, "cover"),
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
					}));
					const externalLinks = await getUnitExternalLinkPreviewWithSources({
						unitId: params.unitId,
						localizationLanguages,
						profileId: identity.authorization.profileId,
					});
					const creditAttributions = await database
						.select({
							id: creditAttribution.id,
							sourceUnitId: creditAttribution.sourceUnitId,
							role: creditAttribution.role,
						})
						.from(creditAttribution)
						.innerJoin(unit, eq(unit.id, creditAttribution.sourceUnitId))
						.where(
							and(
								eq(creditAttribution.creditedUnitId, params.unitId),
								publiclyReadableUnitCondition(),
							),
						);
					const subjectAssociations = await database
						.select({
							id: subjectAssociation.id,
							unitId: subjectAssociation.unitId,
							role: subjectAssociation.role,
						})
						.from(subjectAssociation)
						.innerJoin(unit, eq(unit.id, subjectAssociation.unitId))
						.where(
							and(
								eq(subjectAssociation.entityId, params.unitId),
								publiclyReadableUnitCondition(),
							),
						);
					const contextPosts = await getAssociationContextPostsByAssociationIds(
						subjectAssociations.map(({ id }) => id),
						localizationLanguages,
						identity.authorization.profileId,
					);
					const presentedSubjectAssociations = subjectAssociations.map((association) => ({
						...association,
						contextPost: contextPosts.get(association.id) ?? null,
					}));
					const [owner] = await database
						.select({ profileId: unitOwnership.profileId })
						.from(unitOwnership)
						.where(
							and(
								eq(unitOwnership.unitId, params.unitId),
								isNull(unitOwnership.revokedAt),
							),
						)
						.limit(1);
					const entityEntry = entry;
					const ownerSummary = owner?.profileId
						? ((
								await getPublicUnitSummariesByIds(
									[owner.profileId],
									localizationLanguages,
								)
							).get(owner.profileId) ?? null)
						: null;
					const [
						canEdit,
						canEditCreditAttributions,
						accessDecision,
						creditDecision,
						subjectDecision,
						ownershipClaim,
					] = await Promise.all([
						identity.authorization.unit.canUpdate(params.unitId, ["localizations"]),
						identity.authorization.unit.canUpdate(params.unitId, [
							"credit-attributions",
						]),
						identity.authorization.unit.decide(params.unitId, "unit.access.manage"),
						identity.authorization.unit.decide(
							params.unitId,
							"unit.association.manage",
							["associations", "credit"],
						),
						identity.authorization.unit.decide(
							params.unitId,
							"unit.association.manage",
							["associations", "subject"],
						),
						getPendingUnitOwnershipClaim(
							params.unitId,
							identity.authorization.profileId,
						),
					]);
					return {
						...entityEntry,
						ownershipMode: unitOwnershipModeFromOwnerProfileId(
							owner?.profileId ?? null,
						),
						kind: requireEntityKind(entry.kind),
						language: selectedLocalization.language,
						avatar: presentAvatar(
							resolveUnitLocalizationAvatarFromOrdered(
								storedLocalizations,
								localizationLanguages,
							),
						),
						banner: presentImageAsset(
							resolveUnitLocalizationImageAssetIdFromOrdered(
								storedLocalizations,
								"banner",
								localizationLanguages,
							),
							"banner",
						),
						cover: presentImageAsset(
							resolveUnitLocalizationImageAssetIdFromOrdered(
								storedLocalizations,
								"cover",
								localizationLanguages,
							),
							"cover",
						),
						localizations,
						attributions,
						owner: ownerSummary,
						externalLinks,
						ownershipClaim: ownershipClaim
							? { ...ownershipClaim, state: "pending" as const }
							: null,
						capabilities: {
							canEdit,
							canEditCreditAttributions,
							canManageAccess: accessDecision.allowed,
							canManageCreditAssociations: creditDecision.allowed,
							canManageSubjectAssociations: subjectDecision.allowed,
						},
						creditAttributions,
						subjectAssociations: presentedSubjectAssociations,
					};
				},
				{
					params: UnitIdParams,
					query: EntityDetailQuery,
					response: {
						[StatusCodes.OK]: EntityDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EntityEntryNotFound"]),
					},
					detail: { summary: "Get entity entry", tags: ["Entity"] },
				},
			)
			.put(
				"/:unitId/localizations/:language",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, "entity");
					await upsertLocalization(params.unitId, authorization, {
						...body,
						language: params.language,
					});
					return { id: params.unitId };
				},
				{
					access: "contribute:unit:update",
					params: EntityLocalizationParams,
					body: UnitLocalizationBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitResourceMutationNotFoundResponse,
					},
					detail: { summary: "Create or replace entity localization", tags: ["Entity"] },
				},
			),
	)
	.group("/tags", (app) =>
		app
			.get(
				"",
				async ({ query }) => {
					const localizationLanguages = query.localizationLanguages ?? [];
					return {
						items: await database
							.select({
								id: unit.id,
								language: unitLocalization.language,
								title: unitLocalization.title,
								summary: unitLocalization.summary,
							})
							.from(unit)
							.innerJoin(
								unitLocalization,
								and(
									eq(unitLocalization.unitId, unit.id),
									eq(
										unitLocalization.language,
										resolvedUnitLocalizationLanguage(
											unit.id,
											localizationLanguages,
										),
									),
								),
							)
							.where(
								and(
									eq(unit.kind, "tag"),
									eq(unit.status, "published"),
									eq(unit.visibility, "public"),
								),
							)
							.orderBy(desc(unit.createdAt))
							.limit(query.limit ?? 20),
					};
				},
				{
					query: ListTagsQuery,
					response: { [StatusCodes.OK]: TagListResponse },
					detail: { summary: "List tags", tags: ["Tags"] },
				},
			)
			.post(
				"",
				async ({ profile, body }) => ({
					id: await createUnitResource("tag", profile.unitId, body),
				}),
				{
					access: "contribute:unit:create",
					body: CreateUnitResourceBody,
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create tag", tags: ["Tags"] },
				},
			)
			.get(
				"/:tagId",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const localizationLanguages = query.localizationLanguages ?? [];
					const [tagEntry] = await database
						.select({
							id: unit.id,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(tag)
						.innerJoin(unit, eq(unit.id, tag.id))
						.where(and(eq(tag.id, params.tagId), publiclyReadableUnitCondition()))
						.limit(1);
					if (!tagEntry) throw new TagNotFound();
					const storedLocalizations = await database
						.select()
						.from(unitLocalization)
						.where(eq(unitLocalization.unitId, params.tagId))
						.orderBy(asc(unitLocalization.position), asc(unitLocalization.language));
					const selectedLocalization = resolveUnitLocalizationFromOrdered(
						storedLocalizations,
						localizationLanguages,
					);
					if (!selectedLocalization) throw new TagNotFound();
					const canEdit = await identity.authorization.unit.canUpdate(params.tagId, [
						"localizations",
					]);
					return {
						...tagEntry,
						language: selectedLocalization.language,
						avatar: presentAvatar(
							resolveUnitLocalizationAvatarFromOrdered(
								storedLocalizations,
								localizationLanguages,
							),
						),
						localizations: storedLocalizations.map((row) => ({
							unitId: row.unitId,
							language: row.language,
							position: row.position,
							title: row.title,
							summary: row.summary,
							description:
								row.description === null
									? null
									: toPortableTextResponse(
											row.description,
											"unit_localization.description",
										),
							avatar: presentAvatar(avatarReferenceFromColumns(row)),
							banner: presentImageAsset(row.bannerAssetId, "banner"),
							cover: presentImageAsset(row.coverAssetId, "cover"),
							createdAt: row.createdAt,
							updatedAt: row.updatedAt,
						})),
						capabilities: { canEdit },
					};
				},
				{
					params: TagDetailParams,
					query: TagDetailQuery,
					response: {
						[StatusCodes.OK]: TagDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
					},
					detail: { summary: "Get tag detail", tags: ["Tags"] },
				},
			)
			.put(
				"/:tagId/localizations/:language",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.tagId, "tag");
					await upsertLocalization(params.tagId, authorization, {
						...body,
						language: params.language,
					});
					return { id: params.tagId };
				},
				{
					access: "contribute:unit:update",
					params: TagLocalizationParams,
					body: UnitLocalizationBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitResourceMutationNotFoundResponse,
					},
					detail: { summary: "Create or replace tag localization", tags: ["Tags"] },
				},
			),
	)
	.group("/units/:type/:unitId", (app) =>
		app
			.get(
				"/aliases",
				async ({ params, query, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [rows, curationVersion] = await Promise.all([
						database
							.select({
								id: unitAlias.id,
								unitId: unitAlias.unitId,
								term: unitAlias.term,
								normalizedTerm: unitAlias.normalizedTerm,
								language: unitAlias.language,
								kind: unitAlias.kind,
								createdByProfileId: unitAlias.createdByProfileId,
								viewerVote: unitAliasVote.value,
								score: unitAliasVoteStat.score,
								voteCount: unitAliasVoteStat.voteCount,
								voteUpdatedAt: unitAliasVoteStat.updatedAt,
								pinned: unitAlias.pinned,
								position: unitAlias.position,
								createdAt: unitAlias.createdAt,
								updatedAt: unitAlias.updatedAt,
							})
							.from(unitAlias)
							.leftJoin(
								unitAliasVoteStat,
								eq(unitAliasVoteStat.aliasId, unitAlias.id),
							)
							.leftJoin(
								unitAliasVote,
								and(
									eq(unitAliasVote.aliasId, unitAlias.id),
									eq(unitAliasVote.profileId, profile.unitId),
								),
							)
							.where(
								and(
									eq(unitAlias.unitId, params.unitId),
									isNull(unitAlias.withdrawnAt),
								),
							)
							.limit(UnitReferenceActiveLimit + 1),
						getReferenceCurationVersion(params.unitId, "alias"),
					]);
					if (rows.length > UnitReferenceActiveLimit)
						throw new UnitReferenceLimitReached(UnitReferenceActiveLimit);
					const references = rows.map((row) => {
						const { viewerVote, score, voteCount, voteUpdatedAt, ...reference } = row;
						return {
							...reference,
							voteSummary: presentBinaryVoteSummary({
								score: score ?? 0n,
								voteCount: voteCount ?? 0n,
								viewerVote,
								updatedAt: voteUpdatedAt,
								name: "Alias",
							}),
						};
					});
					const page = paginateUnitReferences({
						references,
						context: {
							unitId: params.unitId,
							kind: "alias",
							curationVersion,
							rankingVersion: unitReferenceRankingVersion(references),
						},
						cursor: query.cursor,
						limit: query.limit ?? UnitReferencePageDefault,
					});
					return {
						...page,
						curationVersion,
					};
				},
				{
					access: "unit:read",
					params: UnitAliasUnitParams,
					query: UnitAliasListQuery,
					response: {
						[StatusCodes.OK]: AliasListResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitReferenceLimitReached"]),
					},
					detail: { summary: "List Unit alias references", tags: ["Units"] },
				},
			)
			.post(
				"/aliases",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const term = body.term.trim();
					const normalizedTerm = normalizeAliasTerm(term);
					const aliasId = await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`unit-reference:alias:${params.unitId}`}, 0))`,
						);
						const [existing] = await tx
							.select()
							.from(unitAlias)
							.where(
								and(
									eq(unitAlias.unitId, params.unitId),
									eq(unitAlias.normalizedTerm, normalizedTerm),
									body.language
										? eq(unitAlias.language, body.language)
										: isNull(unitAlias.language),
								),
							)
							.limit(1);
						if (existing?.withdrawnAt) throw new UnitReferenceWithdrawn();
						if (!existing)
							await ensureUnitReferenceCanBeCreated(tx, {
								unitId: params.unitId,
								kind: "alias",
							});
						const reference =
							existing ??
							(
								await tx
									.insert(unitAlias)
									.values({
										unitId: params.unitId,
										term,
										normalizedTerm,
										language: body.language,
										kind: body.kind,
										createdByProfileId: profile.unitId,
									})
									.returning()
							)[0];
						if (!reference) throw new Error("Alias could not be created");
						await tx
							.insert(unitAliasVote)
							.values({
								aliasId: reference.id,
								profileId: profile.unitId,
								value: 1,
							})
							.onConflictDoUpdate({
								target: [unitAliasVote.aliasId, unitAliasVote.profileId],
								set: { value: 1, updatedAt: new Date() },
								setWhere: ne(unitAliasVote.value, 1),
							});
						return reference.id;
					});
					return getAliasReference(aliasId, profile.unitId);
				},
				{
					access: "contribute:interaction:write",
					params: UnitAliasUnitParams,
					body: AddUnitAliasBody,
					response: {
						[StatusCodes.OK]: AliasResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceLimitReached",
							"UnitReferenceWithdrawn",
						]),
					},
					detail: { summary: "Propose Unit alias", tags: ["Units"] },
				},
			)
			.put(
				"/aliases/:aliasId/vote",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [target] = await database
						.select({ id: unitAlias.id })
						.from(unitAlias)
						.where(
							and(
								eq(unitAlias.id, params.aliasId),
								eq(unitAlias.unitId, params.unitId),
								isNull(unitAlias.withdrawnAt),
							),
						)
						.limit(1);
					if (!target) throw new AliasNotFound();
					await database
						.insert(unitAliasVote)
						.values({
							aliasId: params.aliasId,
							profileId: profile.unitId,
							value: body.value,
						})
						.onConflictDoUpdate({
							target: [unitAliasVote.aliasId, unitAliasVote.profileId],
							set: { value: body.value, updatedAt: new Date() },
							setWhere: ne(unitAliasVote.value, body.value),
						});
					return getAliasVoteSummary(params.aliasId, body.value);
				},
				{
					access: "contribute:interaction:write",
					params: UnitAliasParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
					},
					detail: { summary: "Vote on Unit alias", tags: ["Units"] },
				},
			)
			.delete(
				"/aliases/:aliasId/vote",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [target] = await database
						.select({ id: unitAlias.id })
						.from(unitAlias)
						.where(
							and(
								eq(unitAlias.id, params.aliasId),
								eq(unitAlias.unitId, params.unitId),
								isNull(unitAlias.withdrawnAt),
							),
						)
						.limit(1);
					if (!target) throw new AliasNotFound();
					await database
						.delete(unitAliasVote)
						.where(
							and(
								eq(unitAliasVote.aliasId, params.aliasId),
								eq(unitAliasVote.profileId, profile.unitId),
							),
						);
					return getAliasVoteSummary(params.aliasId, null);
				},
				{
					access: "write:interaction:write",
					params: UnitAliasParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
					},
					detail: { summary: "Remove Unit alias vote", tags: ["Units"] },
				},
			)
			.patch(
				"/aliases/:aliasId",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "aliases"),
					);
					const result = await updateUnitAliasCuration({
						unitId: params.unitId,
						aliasId: params.aliasId,
						actorProfileId: profile.unitId,
						baseVersion: body.baseVersion,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
					return {
						reference: await getAliasReference(params.aliasId, profile.unitId),
						curationVersion: result.curationVersion,
					};
				},
				{
					access: "write:unit:update",
					params: UnitAliasParams,
					body: UpdateUnitReferenceCurationBody,
					response: {
						[StatusCodes.OK]: AliasCurationResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceCurationChanged",
							"UnitReferencePinnedLimitReached",
						]),
					},
					detail: { summary: "Update Unit Alias curation", tags: ["Units"] },
				},
			)
			.delete(
				"/aliases/:aliasId",
				async ({ params, query, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "aliases"),
					);
					await withdrawUnitAlias({
						unitId: params.unitId,
						aliasId: params.aliasId,
						actorProfileId: profile.unitId,
						baseVersion: query.baseVersion,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitAliasParams,
					query: WithdrawUnitReferenceQuery,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceCurationChanged",
						]),
					},
					detail: {
						summary: "Withdraw Unit alias reference",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
			)
			.post(
				"/credit-attributions",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					if (!isCreditAttributionRoleForUnitKind(params.type, body.role))
						throw new CreditAttributionRoleInvalid(params.type, body.role);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"credit-attributions",
					]);
					const credit = await database.transaction(async (tx) => {
						await ensureDirectCreditAttributionAllowed(
							authorization,
							tx,
							body.creditedUnitId,
						);
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.unitId}::text, 0))`,
						);
						const [last] = await tx
							.select({ position: creditAttribution.position })
							.from(creditAttribution)
							.where(eq(creditAttribution.sourceUnitId, params.unitId))
							.orderBy(desc(creditAttribution.position), desc(creditAttribution.id))
							.limit(1);
						const [created] = await tx
							.insert(creditAttribution)
							.values({
								sourceUnitId: params.unitId,
								...body,
								position:
									body.position ??
									fractionalPositionBetween(last?.position, null),
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							event: "update",
						});
						return created;
					});
					if (!credit) throw new Error("Credit insertion did not return a row");
					const attributions =
						(await getAttributionSummariesByUnitIds([params.unitId])).get(
							params.unitId,
						) ?? [];
					const created = attributions.find(({ id }) => id === credit.id);
					if (!created)
						throw new Error("Created credit attribution could not be resolved");
					return created;
				},
				{
					access: "contribute:unit:update",
					params: AttributionUnitParams,
					body: AddUnitCreditBody,
					response: {
						[StatusCodes.OK]: CreditAttributionResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"CreditAttributionRoleInvalid",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"EntityEntryNotFound",
						]),
					},
					detail: { summary: "Add Unit credit attribution", tags: ["Units"] },
				},
			)
			.delete(
				"/credit-attributions/:associationId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"credit-attributions",
					]);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(creditAttribution)
							.where(
								and(
									eq(creditAttribution.id, params.associationId),
									eq(creditAttribution.sourceUnitId, params.unitId),
								),
							)
							.returning({ id: creditAttribution.id });
						if (!deleted.length) throw new CreditAttributionNotFound();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: AttributionAssociationParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"CreditAttributionNotFound",
						]),
					},
					detail: {
						summary: "Remove Unit credit attribution",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
			)
			.post(
				"/subject-associations",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"subject-associations",
					]);
					if (body.contextPostId)
						await authorization.unit.ensureCanRead(
							body.contextPostId,
							() => new AssociationContextPostInvalid(),
						);
					const association = await database.transaction(async (tx) => {
						if (body.contextPostId)
							await ensureWikiAssociationContextPost(tx, body.contextPostId);
						await authorization.entity.ensureAssociationAllowed(
							tx,
							body.entityId,
							"subject",
						);
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.unitId}::text, 0))`,
						);
						const [last] = await tx
							.select({ position: subjectAssociation.position })
							.from(subjectAssociation)
							.where(eq(subjectAssociation.unitId, params.unitId))
							.orderBy(desc(subjectAssociation.position), desc(subjectAssociation.id))
							.limit(1);
						const [created] = await tx
							.insert(subjectAssociation)
							.values({
								unitId: params.unitId,
								entityId: body.entityId,
								contextPostId: body.contextPostId ?? null,
								role: body.role,
								position:
									body.position ??
									fractionalPositionBetween(last?.position, null),
							})
							.returning();
						if (!created)
							throw new Error("Subject association insertion returned no row");
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							event: "update",
						});
						return created;
					});
					return association;
				},
				{
					access: "contribute:unit:update",
					params: UnitUnitParams,
					body: AddUnitSubjectAssociationBody,
					response: {
						[StatusCodes.OK]: SubjectAssociationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"AssociationContextPostInvalid",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"EntityEntryNotFound",
						]),
					},
					detail: { summary: "Add Unit subject association", tags: ["Units"] },
				},
			)
			.delete(
				"/subject-associations/:associationId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"subject-associations",
					]);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(subjectAssociation)
							.where(
								and(
									eq(subjectAssociation.id, params.associationId),
									eq(subjectAssociation.unitId, params.unitId),
								),
							)
							.returning({ id: subjectAssociation.id });
						if (!deleted.length) throw new SubjectAssociationNotFound();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitAssociationParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SubjectAssociationNotFound",
						]),
					},
					detail: {
						summary: "Remove Unit subject association",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
			)
			.get(
				"/external-links",
				async ({ params, query, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const localizationLanguages = query.localizationLanguages ?? [];
					const [rows, curationVersion] = await Promise.all([
						database
							.select({
								id: unitExternalLink.id,
								unitId: unitExternalLink.unitId,
								sourceEntityId: unitExternalLink.sourceEntityId,
								url: unitExternalLink.url,
								normalizedUrl: unitExternalLink.normalizedUrl,
								normalizedUrlHash: unitExternalLink.normalizedUrlHash,
								createdByProfileId: unitExternalLink.createdByProfileId,
								viewerVote: unitExternalLinkVote.value,
								score: unitExternalLinkVoteStat.score,
								voteCount: unitExternalLinkVoteStat.voteCount,
								voteUpdatedAt: unitExternalLinkVoteStat.updatedAt,
								pinned: unitExternalLink.pinned,
								position: unitExternalLink.position,
								createdAt: unitExternalLink.createdAt,
								updatedAt: unitExternalLink.updatedAt,
							})
							.from(unitExternalLink)
							.leftJoin(
								unitExternalLinkVoteStat,
								eq(unitExternalLinkVoteStat.externalLinkId, unitExternalLink.id),
							)
							.leftJoin(
								unitExternalLinkVote,
								and(
									eq(unitExternalLinkVote.externalLinkId, unitExternalLink.id),
									eq(unitExternalLinkVote.profileId, profile.unitId),
								),
							)
							.where(
								and(
									eq(unitExternalLink.unitId, params.unitId),
									isNull(unitExternalLink.withdrawnAt),
								),
							)
							.limit(UnitReferenceActiveLimit + 1),
						getReferenceCurationVersion(params.unitId, "external_link"),
					]);
					if (rows.length > UnitReferenceActiveLimit)
						throw new UnitReferenceLimitReached(UnitReferenceActiveLimit);
					const references = rows.map((row) => {
						const { viewerVote, score, voteCount, voteUpdatedAt, ...reference } = row;
						return {
							...reference,
							voteSummary: presentBinaryVoteSummary({
								score: score ?? 0n,
								voteCount: voteCount ?? 0n,
								viewerVote,
								updatedAt: voteUpdatedAt,
								name: "External link",
							}),
						};
					});
					const page = paginateUnitReferences({
						references,
						context: {
							unitId: params.unitId,
							kind: "external_link",
							curationVersion,
							rankingVersion: unitReferenceRankingVersion(references),
						},
						cursor: query.cursor,
						limit: query.limit ?? UnitReferencePageDefault,
					});
					return {
						items: await attachReadableSourceEntities(
							page.items,
							localizationLanguages,
							profile.unitId,
						),
						nextCursor: page.nextCursor,
						curationVersion,
					};
				},
				{
					access: "unit:read",
					params: UnitExternalLinkUnitParams,
					query: UnitExternalLinkListQuery,
					response: {
						[StatusCodes.OK]: UnitExternalLinkListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitReferenceLimitReached"]),
					},
					detail: { summary: "List Unit external-link references", tags: ["Units"] },
				},
			)
			.post(
				"/external-links",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					await ensureReadableSourceEntity(authorization.unit, body.sourceEntityId);
					const { url, normalizedUrl } = normalizeExternalWebUrl(body.url);
					const normalizedUrlHash = createHash("sha256")
						.update(normalizedUrl)
						.digest("hex");
					const externalLinkId = await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`unit-reference:external_link:${params.unitId}`}, 0))`,
						);
						const [existing] = await tx
							.select()
							.from(unitExternalLink)
							.where(
								and(
									eq(unitExternalLink.unitId, params.unitId),
									eq(unitExternalLink.sourceEntityId, body.sourceEntityId),
									eq(unitExternalLink.normalizedUrlHash, normalizedUrlHash),
								),
							)
							.limit(1);
						if (existing?.withdrawnAt) throw new UnitReferenceWithdrawn();
						if (
							existing?.normalizedUrl !== undefined &&
							existing.normalizedUrl !== normalizedUrl
						)
							throw new Error("External link URL normalization hash collision");
						if (!existing)
							await ensureUnitReferenceCanBeCreated(tx, {
								unitId: params.unitId,
								kind: "external_link",
							});
						const reference =
							existing ??
							(
								await tx
									.insert(unitExternalLink)
									.values({
										unitId: params.unitId,
										sourceEntityId: body.sourceEntityId,
										url,
										normalizedUrl,
										normalizedUrlHash,
										createdByProfileId: profile.unitId,
									})
									.returning()
							)[0];
						if (!reference) throw new Error("External link could not be created");
						await tx
							.insert(unitExternalLinkVote)
							.values({
								externalLinkId: reference.id,
								profileId: profile.unitId,
								value: 1,
							})
							.onConflictDoUpdate({
								target: [
									unitExternalLinkVote.externalLinkId,
									unitExternalLinkVote.profileId,
								],
								set: { value: 1, updatedAt: new Date() },
								setWhere: ne(unitExternalLinkVote.value, 1),
							});
						return reference.id;
					});
					return getExternalLinkReference(externalLinkId, profile.unitId);
				},
				{
					access: "contribute:interaction:write",
					params: UnitExternalLinkUnitParams,
					body: AddUnitExternalLinkBody,
					response: {
						[StatusCodes.OK]: UnitExternalLinkResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"EntityEntryNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceLimitReached",
							"UnitReferenceWithdrawn",
						]),
					},
					detail: { summary: "Propose Unit external link", tags: ["Units"] },
				},
			)
			.put(
				"/external-links/:externalLinkId/vote",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [target] = await database
						.select({ id: unitExternalLink.id })
						.from(unitExternalLink)
						.where(
							and(
								eq(unitExternalLink.id, params.externalLinkId),
								eq(unitExternalLink.unitId, params.unitId),
								isNull(unitExternalLink.withdrawnAt),
							),
						)
						.limit(1);
					if (!target) throw new UnitExternalLinkNotFound();
					await database
						.insert(unitExternalLinkVote)
						.values({
							externalLinkId: params.externalLinkId,
							profileId: profile.unitId,
							value: body.value,
						})
						.onConflictDoUpdate({
							target: [
								unitExternalLinkVote.externalLinkId,
								unitExternalLinkVote.profileId,
							],
							set: { value: body.value, updatedAt: new Date() },
							setWhere: ne(unitExternalLinkVote.value, body.value),
						});
					return getExternalLinkVoteSummary(params.externalLinkId, body.value);
				},
				{
					access: "contribute:interaction:write",
					params: UnitExternalLinkParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"UnitExternalLinkNotFound",
						]),
					},
					detail: { summary: "Vote on Unit external link", tags: ["Units"] },
				},
			)
			.delete(
				"/external-links/:externalLinkId/vote",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [target] = await database
						.select({ id: unitExternalLink.id })
						.from(unitExternalLink)
						.where(
							and(
								eq(unitExternalLink.id, params.externalLinkId),
								eq(unitExternalLink.unitId, params.unitId),
								isNull(unitExternalLink.withdrawnAt),
							),
						)
						.limit(1);
					if (!target) throw new UnitExternalLinkNotFound();
					await database
						.delete(unitExternalLinkVote)
						.where(
							and(
								eq(unitExternalLinkVote.externalLinkId, params.externalLinkId),
								eq(unitExternalLinkVote.profileId, profile.unitId),
							),
						);
					return getExternalLinkVoteSummary(params.externalLinkId, null);
				},
				{
					access: "write:interaction:write",
					params: UnitExternalLinkParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"UnitExternalLinkNotFound",
						]),
					},
					detail: { summary: "Remove Unit external link vote", tags: ["Units"] },
				},
			)
			.patch(
				"/external-links/:externalLinkId",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "external-links"),
					);
					const result = await updateUnitExternalLinkCuration({
						unitId: params.unitId,
						externalLinkId: params.externalLinkId,
						actorProfileId: profile.unitId,
						baseVersion: body.baseVersion,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
					return {
						reference: await getExternalLinkReference(
							params.externalLinkId,
							profile.unitId,
						),
						curationVersion: result.curationVersion,
					};
				},
				{
					access: "write:unit:update",
					params: UnitExternalLinkParams,
					body: UpdateUnitReferenceCurationBody,
					response: {
						[StatusCodes.OK]: UnitExternalLinkCurationResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"UnitExternalLinkNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceCurationChanged",
							"UnitReferencePinnedLimitReached",
						]),
					},
					detail: { summary: "Update Unit external link curation", tags: ["Units"] },
				},
			)
			.delete(
				"/external-links/:externalLinkId",
				async ({ params, query, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "external-links"),
					);
					await withdrawUnitExternalLink({
						unitId: params.unitId,
						externalLinkId: params.externalLinkId,
						actorProfileId: profile.unitId,
						baseVersion: query.baseVersion,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitExternalLinkParams,
					query: WithdrawUnitReferenceQuery,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"UnitExternalLinkNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceCurationChanged",
						]),
					},
					detail: {
						summary: "Withdraw Unit external-link reference",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
			)
			.put(
				"/tags/:tagId",
				async ({ params, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await Promise.all([
						authorization.unit.ensureCanRead(params.unitId),
						authorization.unit.ensureCanRead(params.tagId),
					]);
					const [tagRecord] = await database
						.select({ id: tag.id })
						.from(tag)
						.where(eq(tag.id, params.tagId))
						.limit(1);
					if (!tagRecord) throw new TagNotFound();
					await database.transaction(async (tx) => {
						await tx
							.insert(unitTag)
							.values({
								unitId: params.unitId,
								tagId: params.tagId,
								createdByProfileId: authorization.profileId,
							})
							.onConflictDoNothing();
						await tx
							.insert(unitTagVote)
							.values({
								unitId: params.unitId,
								tagId: params.tagId,
								profileId: authorization.profileId,
								value: 1,
							})
							.onConflictDoUpdate({
								target: [
									unitTagVote.unitId,
									unitTagVote.tagId,
									unitTagVote.profileId,
								],
								set: { value: 1, updatedAt: new Date() },
							});
					});
					const [application] = await database
						.select()
						.from(unitTag)
						.where(
							and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)),
						)
						.limit(1);
					if (!application) throw new TagApplicationNotFound(true);
					const totals = await getTagVoteSummary(params.unitId, params.tagId, 1);
					return {
						...application,
						score: totals.score,
						voteCount: totals.voteCount,
					};
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagParams,
					body: TagUnitBody,
					response: {
						[StatusCodes.OK]: TagApplicationResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagNotFound",
							"TagApplicationNotFound",
						]),
					},
					detail: { summary: "Tag unit", tags: ["Units"] },
				},
			)
			.patch(
				"/tags/:tagId",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					return updateDirectUnitTagCuration({
						unitId: params.unitId,
						tagId: params.tagId,
						actorProfileId: profile.unitId,
						expectedUpdatedAt: body.updatedAt,
						expectedFeaturedTagIds: body.expectedFeaturedTagIds,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
				},
				{
					access: "write:unit:update",
					params: UnitTagParams,
					body: UpdateUnitTagCurationBody,
					response: {
						[StatusCodes.OK]: TagApplicationResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagApplicationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitTagCurationChanged"]),
					},
					detail: {
						summary: "Update Unit tag curation",
						tags: ["Units"],
					},
				},
			)
			.delete(
				"/tags/:tagId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(unitTag)
							.where(
								and(
									eq(unitTag.unitId, params.unitId),
									eq(unitTag.tagId, params.tagId),
								),
							)
							.returning({ id: unitTag.tagId });
						if (!deleted.length) throw new TagApplicationNotFound();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:update",
					params: UnitTagParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagApplicationNotFound",
						]),
					},
					detail: {
						summary: "Remove Unit tag",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
			)
			.put(
				"/tags/:tagId/vote",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [application] = await database
						.select({ tagId: unitTag.tagId })
						.from(unitTag)
						.where(
							and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)),
						)
						.limit(1);
					if (!application) throw new TagApplicationNotFound();
					await database
						.insert(unitTagVote)
						.values({
							unitId: params.unitId,
							tagId: application.tagId,
							profileId: profile.unitId,
							value: body.value,
						})
						.onConflictDoUpdate({
							target: [unitTagVote.unitId, unitTagVote.tagId, unitTagVote.profileId],
							set: { value: body.value, updatedAt: new Date() },
						});
					return getTagVoteSummary(params.unitId, application.tagId, body.value);
				},
				{
					access: "contribute:interaction:write",
					params: UnitTagParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagStructure",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagApplicationNotFound",
						]),
					},
					detail: { summary: "Vote on Unit tag", tags: ["Units"] },
				},
			)
			.delete(
				"/tags/:tagId/vote",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const [application] = await database
						.select({ tagId: unitTag.tagId })
						.from(unitTag)
						.where(
							and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)),
						)
						.limit(1);
					if (!application) throw new TagApplicationNotFound();
					await database
						.delete(unitTagVote)
						.where(
							and(
								eq(unitTagVote.unitId, params.unitId),
								eq(unitTagVote.tagId, application.tagId),
								eq(unitTagVote.profileId, profile.unitId),
							),
						);
					return getTagVoteSummary(params.unitId, application.tagId, null);
				},
				{
					access: "write:interaction:write",
					params: UnitTagParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagApplicationNotFound",
						]),
					},
					detail: { summary: "Remove Unit tag vote", tags: ["Units"] },
				},
			),
	);
