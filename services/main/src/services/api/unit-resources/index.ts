import { presentImageAsset } from "../image-assets/presentation";
import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";

import { and, asc, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { RevisionContextBody } from "../schema";
import { Decode } from "typebox/value";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { unitScope } from "../../authorization/unit/scope";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	creditAttribution,
	entityIdentity,
	subjectAssociation,
	subjectAssociationJudgment,
	subjectAssociationJudgmentStat,
	tag,
	unitAlias,
	unitAliasVote,
	unitAliasVoteStat,
	unitExternalLink,
	unitExternalLinkVote,
	unitExternalLinkVoteStat,
	unitLocalization,
	unitReferenceCurationHead,
	unitTag,
	unitTagJudgment,
	unitTagJudgmentStat,
} from "../../database/schema";
import {
	type UnitReferenceCurationKind,
	UnitReferenceActiveLimit,
	UnitReferencePageDefault,
} from "../../database/schema/contract-values";
import { runVoteTransaction } from "../../database/vote-admission";
import {
	CreditAttributionNotFound,
	CreditAttributionRoleInvalid,
	EntityEntryNotFound,
	SubjectAssociationNotFound,
} from "../../entities/errors";
import { fractionalPositionBetween } from "../../ordering/position";
import { updateDirectUnitTagCuration } from "../../tags/curation";
import { ensureWikiAssociationContextPost } from "../../units/association-context";
import { ensureDirectCreditAttributionAllowed } from "../../units/attribution-authorization";
import { presentAvatar } from "../../units/avatar";
import { AssociationContextPostInvalid } from "../../units/errors";
import { attachReadableSourceEntities } from "../../units/external-links";
import {
	avatarReferenceFromColumns,
	resolvedUnitLocalizationLanguage,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
} from "../../units/localization";
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
import { upsertLocalization } from "../../units/service";
import { presentBinaryVoteSummary } from "../../votes/binary";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import {
	AliasCurationResponse,
	AliasListResponse,
	AliasResponse,
	CreditAttributionResponse,
	SubjectAssociationResponse,
	SubjectAssociationSpoilerResponse,
	TagApplicationPolicyResponse,
	TagApplicationResponse,
	TagDetailResponse,
	TagListResponse,
	toApiErrorResponse,
	toPortableTextResponse,
	UnitExternalLinkCurationResponse,
	UnitExternalLinkListResponse,
	UnitExternalLinkResponse,
	VoteBackpressureResponse,
	VoteResponse,
} from "../schema/response";
import { TagNotFound } from "../tags/errors";
import { UnitLocalizationBody } from "../units/schema";
import {
	AliasNotFound,
	TagApplicationNotFound,
	UnitExternalLinkNotFound,
	UnitReferenceLimitReached,
	UnitReferenceWithdrawn,
} from "./errors";
import { normalizeExternalWebUrl } from "./external-web-url";
import {
	AddUnitAliasBody,
	AddUnitCreditBody,
	AddUnitExternalLinkBody,
	AddUnitSubjectAssociationBody,
	AttributionAssociationParams,
	AttributionUnitParams,
	CreateUnitResourceBody,
	ListTagsQuery,
	SubjectAssociationSpoilerBody,
	TagDetailParams,
	TagDetailQuery,
	TagLocalizationParams,
	TagUnitBody,
	UnitAliasListQuery,
	UnitAliasParams,
	UnitAliasUnitParams,
	UnitAssociationParams,
	UnitExternalLinkListQuery,
	UnitExternalLinkParams,
	UnitExternalLinkUnitParams,
	UnitTagParams,
	UnitUnitParams,
	UpdateUnitReferenceCurationBody,
	UpdateUnitTagCurationBody,
	VoteBody,
	WithdrawUnitReferenceQuery,
} from "./schema";
import { creditRoleAllowedForReference } from "../../units/credit-role-contract";
import { checkUnitOwner, createTagResource } from "./service";
import { recordResourceRevision, ensureResourceUpdateAllowed } from "../../units/resource-history";
import { decodeDomainCursor, encodeDomainCursor } from "../../catalog/domain-api-pagination";
import { z } from "zod";
import { LocalizationLanguageQuery } from "../schema";
import { getPublicEntitySummariesByIds } from "../../participation/presentation";
import { ValidationError } from "../errors";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitResourceMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"CatalogReferenceNotFound",
	"ImageAssetNotFound",
]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"ParticipationDenied",
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
]);
const UnitInteractionForbiddenResponse = toApiErrorResponse([
	"UnitAccessRestricted",
	"UnitPermissionForbidden",
]);
const publiclyReadableTagCondition = () =>
	and(
		eq(tag.status, "published"),
		eq(tag.visibility, "public"),
		eq(tag.moderationStatus, "approved"),
		isNull(tag.deletedAt),
	);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await database.transaction((tx) => ensureResourceUpdateAllowed(tx, authorization, unitId, scope));
}

async function ensureReadableSourceEntity(
	authorization: UnitAuthorization<string>,
	sourceEntityId: string,
): Promise<void> {
	await authorization.ensureCanRead(sourceEntityId, () => new EntityEntryNotFound());
	const [sourceEntity] = await database
		.select({ id: entityIdentity.id })
		.from(entityIdentity)
		.where(eq(entityIdentity.id, sourceEntityId))
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
			and(eq(unitReferenceCurationHead.unitId, unitId), eq(unitReferenceCurationHead.kind, kind)),
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
			and(eq(unitAliasVote.aliasId, unitAlias.id), eq(unitAliasVote.profileId, viewerProfileId)),
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
			score: unitTagJudgmentStat.score,
			voteCount: unitTagJudgmentStat.voteCount,
			updatedAt: unitTagJudgmentStat.updatedAt,
		})
		.from(unitTagJudgmentStat)
		.where(
			and(
				eq(unitTagJudgmentStat.unitId, unitId),
				eq(unitTagJudgmentStat.tagId, tagId),
				gt(unitTagJudgmentStat.voteCount, 0n),
			),
		);
	return presentBinaryVoteSummary({
		score: totals?.score ?? 0n,
		voteCount: totals?.voteCount ?? 0n,
		viewerVote: value,
		updatedAt: totals?.updatedAt,
		name: "Tag",
	});
}

async function getSubjectAssociationSpoilerSummary(associationId: string, profileId: string) {
	const [[association], [stat], [viewer]] = await Promise.all([
		database
			.select({ id: subjectAssociation.id })
			.from(subjectAssociation)
			.where(eq(subjectAssociation.id, associationId))
			.limit(1),
		database
			.select()
			.from(subjectAssociationJudgmentStat)
			.where(eq(subjectAssociationJudgmentStat.associationId, associationId))
			.limit(1),
		database
			.select({ spoilerLevel: subjectAssociationJudgment.spoilerLevel })
			.from(subjectAssociationJudgment)
			.where(
				and(
					eq(subjectAssociationJudgment.associationId, associationId),
					eq(subjectAssociationJudgment.profileId, profileId),
				),
			)
			.limit(1),
	]);
	if (!association) throw new SubjectAssociationNotFound();
	const voteCount = toSafeInteger(
		stat?.spoilerVoteCount ?? 0n,
		"Subject association spoiler vote count",
	);
	const none = toSafeInteger(stat?.spoilerNoneCount ?? 0n, "Subject association no-spoiler count");
	const minor = toSafeInteger(
		stat?.spoilerMinorCount ?? 0n,
		"Subject association minor-spoiler count",
	);
	const major = toSafeInteger(
		stat?.spoilerMajorCount ?? 0n,
		"Subject association major-spoiler count",
	);
	const level: 0 | 1 | 2 =
		major * 2 >= voteCount && voteCount > 0
			? 2
			: (minor + major) * 2 >= voteCount && voteCount > 0
				? 1
				: 0;
	const viewerLevel = viewer?.spoilerLevel ?? null;
	if (viewerLevel !== null && viewerLevel !== 0 && viewerLevel !== 1 && viewerLevel !== 2)
		throw new Error("Subject association spoiler judgment is invalid");
	const normalizedViewerLevel: 0 | 1 | 2 | null = viewerLevel;
	return {
		associationId,
		level,
		voteCount,
		distribution: { none, minor, major },
		viewerLevel: normalizedViewerLevel,
	};
}

export default new Elysia()
	.use(session)
	.group("/tags", (app) =>
		app
			.get(
				"",
				{
					query: ListTagsQuery,
					response: { [StatusCodes.OK]: TagListResponse },
					detail: { summary: "List tags", tags: ["Tags"] },
				},
				async ({ query }) => {
					const localizationLanguages = query.localizationLanguages ?? [];
					const candidates = database
						.select({ id: tag.id, createdAt: tag.createdAt })
						.from(tag)
						.where(publiclyReadableTagCondition())
						.orderBy(desc(tag.createdAt), desc(tag.id))
						.limit(query.limit ?? 20)
						.as("tag_candidates");
					return {
						items: await database
							.select({
								id: candidates.id,
								language: unitLocalization.language,
								title: unitLocalization.title,
								summary: unitLocalization.summary,
							})
							.from(candidates)
							.innerJoin(
								unitLocalization,
								and(
									eq(unitLocalization.unitId, candidates.id),
									eq(
										unitLocalization.language,
										resolvedUnitLocalizationLanguage(candidates.id, localizationLanguages),
									),
								),
							)

							.orderBy(desc(candidates.createdAt), desc(candidates.id))
							.limit(query.limit ?? 20),
					};
				},
			)
			.post(
				"",
				{
					access: "contribute:unit:create",
					body: CreateUnitResourceBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
					},
					detail: { summary: "Create tag", tags: ["Tags"] },
				},
				async ({ authorization, body }) => ({
					id: await createTagResource(authorization, body),
				}),
			)
			.get(
				"/:tagId",
				{
					params: TagDetailParams,
					query: TagDetailQuery,
					response: {
						[StatusCodes.OK]: TagDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagNotFound"]),
					},
					detail: { summary: "Get tag detail", tags: ["Tags"] },
				},
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request, "unit:read");
					const localizationLanguages = query.localizationLanguages ?? [];
					const [tagEntry] = await database
						.select({
							id: tag.id,
							createdAt: tag.createdAt,
							updatedAt: tag.updatedAt,
						})
						.from(tag)
						.where(and(eq(tag.id, params.tagId), publiclyReadableTagCondition()))
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
							resolveUnitLocalizationAvatarFromOrdered(storedLocalizations, localizationLanguages),
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
									: toPortableTextResponse(row.description, "unit_localization.description"),
							avatar: presentAvatar(avatarReferenceFromColumns(row)),
							banner: presentImageAsset(row.bannerAssetId, "banner"),
							cover: presentImageAsset(row.coverAssetId, "cover"),
							createdAt: row.createdAt,
							updatedAt: row.updatedAt,
						})),
						capabilities: { canEdit },
					};
				},
			)
			.put(
				"/:tagId/localizations/:language",
				{
					access: "contribute:unit:update",
					params: TagLocalizationParams,
					body: UnitLocalizationBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.NOT_FOUND]: UnitResourceMutationNotFoundResponse,
					},
					detail: { summary: "Create or replace tag localization", tags: ["Tags"] },
				},
				async ({ params, authorization, body }) => {
					await checkUnitOwner(params.tagId, "tag");
					const { revisionContext, ...localization } = body;
					await upsertLocalization(params.tagId, authorization, {
						...localization,
						revisionContribution: revisionContext?.contribution,
						language: params.language,
					});
					return { id: params.tagId };
				},
			),
	)
	.group("/resources/:owner/:unitId", (app) =>
		app
			.get(
				"/aliases",
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
				async ({ params, query, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
							.leftJoin(unitAliasVoteStat, eq(unitAliasVoteStat.aliasId, unitAlias.id))
							.leftJoin(
								unitAliasVote,
								and(
									eq(unitAliasVote.aliasId, unitAlias.id),
									eq(unitAliasVote.profileId, entity.id),
								),
							)
							.where(and(eq(unitAlias.unitId, params.unitId), isNull(unitAlias.withdrawnAt)))
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
			)
			.post(
				"/aliases",
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
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
										createdByProfileId: entity.id,
									})
									.returning()
							)[0];
						if (!reference) throw new Error("Alias could not be created");
						await tx
							.insert(unitAliasVote)
							.values({
								aliasId: reference.id,
								profileId: entity.id,
								value: 1,
							})
							.onConflictDoUpdate({
								target: [unitAliasVote.aliasId, unitAliasVote.profileId],
								set: { value: 1, updatedAt: new Date() },
								setWhere: ne(unitAliasVote.value, 1),
							});
						return reference.id;
					});
					return getAliasReference(aliasId, entity.id);
				},
			)
			.put(
				"/aliases/:aliasId/vote",
				{
					access: "contribute:interaction:write",
					params: UnitAliasParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "AliasNotFound"]),
					},
					detail: { summary: "Vote on Unit alias", tags: ["Units"] },
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
							profileId: entity.id,
							value: body.value,
						})
						.onConflictDoUpdate({
							target: [unitAliasVote.aliasId, unitAliasVote.profileId],
							set: { value: body.value, updatedAt: new Date() },
							setWhere: ne(unitAliasVote.value, body.value),
						});
					return getAliasVoteSummary(params.aliasId, body.value);
				},
			)
			.delete(
				"/aliases/:aliasId/vote",
				{
					access: "write:interaction:write",
					params: UnitAliasParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "AliasNotFound"]),
					},
					detail: { summary: "Remove Unit alias vote", tags: ["Units"] },
				},
				async ({ params, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
								eq(unitAliasVote.profileId, entity.id),
							),
						);
					return getAliasVoteSummary(params.aliasId, null);
				},
			)
			.patch(
				"/aliases/:aliasId",
				{
					access: "write:unit:update",
					params: UnitAliasParams,
					body: UpdateUnitReferenceCurationBody,
					response: {
						[StatusCodes.OK]: AliasCurationResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "AliasNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceCurationChanged",
							"UnitReferencePinnedLimitReached",
						]),
					},
					detail: { summary: "Update Unit Alias curation", tags: ["Units"] },
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "aliases"),
					);
					const result = await updateUnitAliasCuration({
						unitId: params.unitId,
						aliasId: params.aliasId,
						actorProfileId: entity.id,
						baseVersion: body.baseVersion,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
					return {
						reference: await getAliasReference(params.aliasId, entity.id),
						curationVersion: result.curationVersion,
					};
				},
			)
			.delete(
				"/aliases/:aliasId",
				{
					access: "write:unit:update",
					params: UnitAliasParams,
					query: WithdrawUnitReferenceQuery,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "AliasNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitReferenceCurationChanged"]),
					},
					detail: {
						summary: "Withdraw Unit alias reference",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
				async ({ params, query, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "aliases"),
					);
					await withdrawUnitAlias({
						unitId: params.unitId,
						aliasId: params.aliasId,
						actorProfileId: entity.id,
						baseVersion: query.baseVersion,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.get(
				"/credit-attributions",
				{
					params: UnitUnitParams,
					query: t.Object({
						...LocalizationLanguageQuery,
						cursor: t.Optional(t.String({ maxLength: 2048 })),
						limit: t.Integer({ minimum: 1, maximum: 100, default: 25 }),
					}),
					response: t.Object({
						items: t.Array(CreditAttributionResponse, { maxItems: 100 }),
						nextCursor: t.Nullable(t.String()),
					}),
					detail: {
						operationId: "listResourceCreditAttributions",
						summary: "Read accepted credit attributions",
						tags: ["Units"],
					},
				},
				async ({ params, query, request }) => {
					await checkUnitOwner(params.unitId, params.owner);
					const identity = await resolveIdentity(request, "unit:read");
					const scope = `credits:${params.owner}:${params.unitId}`;
					const after = (() => {
						try {
							return decodeDomainCursor(
								scope,
								query.cursor,
								z.strictObject({ position: z.string().max(1024), id: z.uuid() }),
							);
						} catch (cause) {
							if (cause instanceof TypeError) throw new ValidationError({ message: cause.message });
							throw cause;
						}
					})();
					return database.transaction(
						async (tx) => {
							await identity.authorization.unit.ensureInTransaction(tx, params.unitId, "unit.read");
							const rows = await tx
								.select({
									id: creditAttribution.id,
									role: creditAttribution.role,
									position: creditAttribution.position,
									creditedEntityId: creditAttribution.creditedEntityId,
								})
								.from(creditAttribution)
								.where(
									and(
										eq(creditAttribution.sourceUnitId, params.unitId),
										after
											? sql`(${creditAttribution.position},${creditAttribution.id}) > (${after.position},${after.id}::uuid)`
											: undefined,
									),
								)
								.orderBy(creditAttribution.position, creditAttribution.id)
								.limit(query.limit);
							const publicEntities = await getPublicEntitySummariesByIds(
								rows.map((row) => row.creditedEntityId),
								query.localizationLanguages ?? [],
								tx,
							);
							const readable = await identity.authorization.unit.readableUnitIdsInTransaction(tx, [
								...publicEntities.keys(),
							]);
							const items = rows.flatMap(({ creditedEntityId, ...row }) => {
								const creditedEntity = publicEntities.get(creditedEntityId);
								return creditedEntity && readable.has(creditedEntityId)
									? [{ ...row, creditedEntity }]
									: [];
							});
							const last = rows.at(-1);
							return {
								items,
								nextCursor:
									last && rows.length === query.limit
										? encodeDomainCursor(scope, { position: last.position, id: last.id })
										: null,
							};
						},
						{ isolationLevel: "repeatable read" },
					);
				},
			)
			.post(
				"/credit-attributions",
				{
					access: "contribute:unit:update",
					params: AttributionUnitParams,
					body: AddUnitCreditBody,
					response: {
						[StatusCodes.OK]: CreditAttributionResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"CreditAttributionRoleInvalid",
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"EntityAssociationRestricted",
							"ParticipationDenied",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
					},
					detail: { summary: "Add Unit credit attribution", tags: ["Units"] },
				},
				async ({ params, authorization, body }) => {
					const { revisionContext, ...creditInput } = body;
					await checkUnitOwner(params.unitId, params.owner);
					if (
						!(await creditRoleAllowedForReference(
							database,
							{ owner: params.owner, id: params.unitId },
							creditInput.role,
						))
					)
						throw new CreditAttributionRoleInvalid(params.owner, creditInput.role);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"credit-attributions",
					]);
					const credit = await database.transaction(async (tx) => {
						await ensureDirectCreditAttributionAllowed(authorization, tx, body.creditedEntityId);
						const creditedEntity = (
							await getPublicEntitySummariesByIds([body.creditedEntityId], [], tx)
						).get(body.creditedEntityId);
						if (
							!creditedEntity ||
							!(
								await authorization.unit.readableUnitIdsInTransaction(tx, [body.creditedEntityId])
							).has(body.creditedEntityId)
						)
							throw new EntityEntryNotFound();
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
								...creditInput,
								position: creditInput.position ?? fractionalPositionBetween(last?.position, null),
							})
							.returning();
						await recordResourceRevision(tx, authorization, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							contribution: revisionContext?.contribution,
							event: "update",
						});
						if (!created) throw new Error("Credit insertion did not return a row");
						return {
							id: created.id,
							position: created.position,
							role: created.role,
							creditedEntity,
						};
					});
					return credit;
				},
			)
			.delete(
				"/credit-attributions/:associationId",
				{
					access: "write:unit:update",
					params: AttributionAssociationParams,
					body: t.Optional(RevisionContextBody),
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
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
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
						await recordResourceRevision(tx, authorization, {
							unitId: params.unitId,
							actorProfileId: entity.id,
							contribution: Decode(RevisionContextBody, body ?? {}).revisionContext?.contribution,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.post(
				"/subject-associations",
				{
					access: "contribute:unit:update",
					params: UnitUnitParams,
					body: AddUnitSubjectAssociationBody,
					response: {
						[StatusCodes.OK]: SubjectAssociationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"AssociationContextPostInvalid",
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"EntityAssociationRestricted",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
					},
					detail: { summary: "Add Unit subject association", tags: ["Units"] },
				},
				async ({ params, authorization, body }) => {
					const { revisionContext, ...associationInput } = body;
					await checkUnitOwner(params.unitId, params.owner);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"subject-associations",
					]);
					if (associationInput.contextPostId)
						await authorization.unit.ensureCanRead(
							associationInput.contextPostId,
							() => new AssociationContextPostInvalid(),
						);
					const association = await database.transaction(async (tx) => {
						if (associationInput.contextPostId)
							await ensureWikiAssociationContextPost(tx, associationInput.contextPostId);
						await authorization.entity.ensureAssociationAllowed(
							tx,
							associationInput.entityId,
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
								entityId: associationInput.entityId,
								contextPostId: associationInput.contextPostId ?? null,
								role: associationInput.role,
								position:
									associationInput.position ?? fractionalPositionBetween(last?.position, null),
							})
							.returning();
						if (!created) throw new Error("Subject association insertion returned no row");
						await recordResourceRevision(tx, authorization, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							contribution: revisionContext?.contribution,
							event: "update",
						});
						return created;
					});
					return association;
				},
			)
			.put(
				"/subject-associations/:associationId/spoiler",
				{
					access: "contribute:interaction:write",
					params: UnitAssociationParams,
					body: SubjectAssociationSpoilerBody,
					response: {
						[StatusCodes.OK]: SubjectAssociationSpoilerResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SubjectAssociationNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Judge the spoiler level of a subject association",
						tags: ["Units"],
					},
				},
				async ({ params, body, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensureCanRead(params.unitId);
					const [association] = await database
						.select({ id: subjectAssociation.id })
						.from(subjectAssociation)
						.where(
							and(
								eq(subjectAssociation.id, params.associationId),
								eq(subjectAssociation.unitId, params.unitId),
							),
						)
						.limit(1);
					if (!association) throw new SubjectAssociationNotFound();
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, (tx) =>
						tx
							.insert(subjectAssociationJudgment)
							.values({
								associationId: params.associationId,
								profileId: entity.id,
								spoilerLevel: body.spoilerLevel,
							})
							.onConflictDoUpdate({
								target: [
									subjectAssociationJudgment.associationId,
									subjectAssociationJudgment.profileId,
								],
								set: {
									spoilerLevel: body.spoilerLevel,
									updatedAt: new Date(),
								},
							}),
					);
					return getSubjectAssociationSpoilerSummary(params.associationId, entity.id);
				},
			)
			.delete(
				"/subject-associations/:associationId/spoiler",
				{
					access: "write:interaction:write",
					params: UnitAssociationParams,
					response: {
						[StatusCodes.OK]: SubjectAssociationSpoilerResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SubjectAssociationNotFound",
						]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Clear a subject-association spoiler judgment",
						tags: ["Units"],
					},
				},
				async ({ params, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensureCanRead(params.unitId);
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, (tx) =>
						tx
							.delete(subjectAssociationJudgment)
							.where(
								and(
									eq(subjectAssociationJudgment.associationId, params.associationId),
									eq(subjectAssociationJudgment.profileId, entity.id),
								),
							),
					);
					return getSubjectAssociationSpoilerSummary(params.associationId, entity.id);
				},
			)
			.delete(
				"/subject-associations/:associationId",
				{
					access: "write:unit:update",
					params: UnitAssociationParams,
					body: t.Optional(RevisionContextBody),
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
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
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
						await recordResourceRevision(tx, authorization, {
							unitId: params.unitId,
							actorProfileId: entity.id,
							contribution: Decode(RevisionContextBody, body ?? {}).revisionContext?.contribution,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.get(
				"/external-links",
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
				async ({ params, query, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
									eq(unitExternalLinkVote.profileId, entity.id),
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
							authorization,
						),
						nextCursor: page.nextCursor,
						curationVersion,
					};
				},
			)
			.post(
				"/external-links",
				{
					access: "contribute:interaction:write",
					params: UnitExternalLinkUnitParams,
					body: AddUnitExternalLinkBody,
					response: {
						[StatusCodes.OK]: UnitExternalLinkResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "EntityEntryNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitReferenceLimitReached",
							"UnitReferenceWithdrawn",
						]),
					},
					detail: { summary: "Propose Unit external link", tags: ["Units"] },
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensureCanRead(params.unitId);
					await ensureReadableSourceEntity(authorization.unit, body.sourceEntityId);
					const { url, normalizedUrl } = normalizeExternalWebUrl(body.url);
					const normalizedUrlHash = createHash("sha256").update(normalizedUrl).digest("hex");
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
						if (existing?.normalizedUrl !== undefined && existing.normalizedUrl !== normalizedUrl)
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
										createdByProfileId: entity.id,
									})
									.returning()
							)[0];
						if (!reference) throw new Error("External link could not be created");
						await tx
							.insert(unitExternalLinkVote)
							.values({
								externalLinkId: reference.id,
								profileId: entity.id,
								value: 1,
							})
							.onConflictDoUpdate({
								target: [unitExternalLinkVote.externalLinkId, unitExternalLinkVote.profileId],
								set: { value: 1, updatedAt: new Date() },
								setWhere: ne(unitExternalLinkVote.value, 1),
							});
						return reference.id;
					});
					return getExternalLinkReference(externalLinkId, entity.id);
				},
			)
			.put(
				"/external-links/:externalLinkId/vote",
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
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
							profileId: entity.id,
							value: body.value,
						})
						.onConflictDoUpdate({
							target: [unitExternalLinkVote.externalLinkId, unitExternalLinkVote.profileId],
							set: { value: body.value, updatedAt: new Date() },
							setWhere: ne(unitExternalLinkVote.value, body.value),
						});
					return getExternalLinkVoteSummary(params.externalLinkId, body.value);
				},
			)
			.delete(
				"/external-links/:externalLinkId/vote",
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
				async ({ params, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
								eq(unitExternalLinkVote.profileId, entity.id),
							),
						);
					return getExternalLinkVoteSummary(params.externalLinkId, null);
				},
			)
			.patch(
				"/external-links/:externalLinkId",
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
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "external-links"),
					);
					const result = await updateUnitExternalLinkCuration({
						unitId: params.unitId,
						externalLinkId: params.externalLinkId,
						actorProfileId: entity.id,
						baseVersion: body.baseVersion,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
					return {
						reference: await getExternalLinkReference(params.externalLinkId, entity.id),
						curationVersion: result.curationVersion,
					};
				},
			)
			.delete(
				"/external-links/:externalLinkId",
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
						[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitReferenceCurationChanged"]),
					},
					detail: {
						summary: "Withdraw Unit external-link reference",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
				async ({ params, query, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(
						params.unitId,
						"unit.reference-curation.manage",
						unitScope("references", "external-links"),
					);
					await withdrawUnitExternalLink({
						unitId: params.unitId,
						externalLinkId: params.externalLinkId,
						actorProfileId: entity.id,
						baseVersion: query.baseVersion,
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.put(
				"/tags/:tagId",
				{
					access: "contribute:interaction:write",
					params: UnitTagParams,
					body: TagUnitBody,
					response: {
						[StatusCodes.OK]: TagApplicationResponse,
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitAccessRestricted",
							"UnitPermissionForbidden",
							"ContentLabelPlatformApplyForbidden",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"TagNotFound",
							"TagApplicationNotFound",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: TagApplicationPolicyResponse,
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Tag unit", tags: ["Units"] },
				},
				async ({ params, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
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
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
						await tx
							.insert(unitTag)
							.values({
								unitId: params.unitId,
								tagId: params.tagId,
								createdByProfileId: authorization.profileId,
							})
							.onConflictDoNothing();
						await tx
							.insert(unitTagJudgment)
							.values({
								unitId: params.unitId,
								tagId: params.tagId,
								profileId: authorization.profileId,
								fitVote: 1,
								fitUpdatedAt: new Date(),
							})
							.onConflictDoUpdate({
								target: [unitTagJudgment.unitId, unitTagJudgment.tagId, unitTagJudgment.profileId],
								set: { fitVote: 1, fitUpdatedAt: new Date(), updatedAt: new Date() },
							});
					});
					const [application] = await database
						.select()
						.from(unitTag)
						.where(and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)))
						.limit(1);
					if (!application) throw new TagApplicationNotFound(true);
					const totals = await getTagVoteSummary(params.unitId, params.tagId, 1);
					return {
						...application,
						score: totals.score,
						voteCount: totals.voteCount,
					};
				},
			)
			.patch(
				"/tags/:tagId",
				{
					access: "write:unit:update",
					params: UnitTagParams,
					body: UpdateUnitTagCurationBody,
					response: {
						[StatusCodes.OK]: TagApplicationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagApplicationNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"UnitTagCurationChanged",
							"ContentLabelPlatformIdentityImmutable",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: TagApplicationPolicyResponse,
					},
					detail: {
						summary: "Update Unit tag curation",
						tags: ["Units"],
					},
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					return updateDirectUnitTagCuration({
						unitId: params.unitId,
						tagId: params.tagId,
						actorProfileId: entity.id,
						expectedUpdatedAt: body.updatedAt,
						expectedFeaturedTagIds: body.expectedFeaturedTagIds,
						contribution: body.revisionContext?.contribution,
						state: body.pinned
							? { pinned: true, position: body.position }
							: { pinned: false, position: null },
					});
				},
			)
			.delete(
				"/tags/:tagId",
				{
					access: "write:unit:update",
					params: UnitTagParams,
					body: t.Optional(RevisionContextBody),
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"UnitAccessRestricted",
							"ContentLabelPlatformRemovalForbidden",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["TagApplicationHasJudgments"]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagApplicationNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: {
						summary: "Remove Unit tag",
						tags: ["Units"],
						responses: NoContentResponse,
					},
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensure(params.unitId, "unit.tag-curation.manage");
					await runVoteTransaction({ family: "unit_tag", authority: "global" }, async (tx) => {
						const deleted = await tx
							.delete(unitTag)
							.where(and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)))
							.returning({ id: unitTag.tagId });
						if (!deleted.length) throw new TagApplicationNotFound();
						await recordResourceRevision(tx, authorization, {
							unitId: params.unitId,
							actorProfileId: entity.id,
							contribution: Decode(RevisionContextBody, body ?? {}).revisionContext?.contribution,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.put(
				"/tags/:tagId/vote",
				{
					access: "contribute:interaction:write",
					params: UnitTagParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"InvalidTagPath",
							"ContentLabelJudgmentForbidden",
						]),
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagApplicationNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Vote on Unit tag", tags: ["Units"] },
				},
				async ({ params, entity, authorization, body }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensureCanRead(params.unitId);
					const tagId = await runVoteTransaction(
						{ family: "unit_tag", authority: "global" },
						async (tx) => {
							const [application] = await tx
								.select({ tagId: unitTag.tagId })
								.from(unitTag)
								.where(and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)))
								.limit(1);
							if (!application) throw new TagApplicationNotFound();
							await tx
								.insert(unitTagJudgment)
								.values({
									unitId: params.unitId,
									tagId: application.tagId,
									profileId: entity.id,
									fitVote: body.value,
									fitUpdatedAt: new Date(),
								})
								.onConflictDoUpdate({
									target: [
										unitTagJudgment.unitId,
										unitTagJudgment.tagId,
										unitTagJudgment.profileId,
									],
									set: { fitVote: body.value, fitUpdatedAt: new Date(), updatedAt: new Date() },
								});
							return application.tagId;
						},
					);
					return getTagVoteSummary(params.unitId, tagId, body.value);
				},
			)
			.delete(
				"/tags/:tagId/vote",
				{
					access: "write:interaction:write",
					params: UnitTagParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.FORBIDDEN]: UnitInteractionForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "TagApplicationNotFound"]),
						[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
					},
					detail: { summary: "Remove Unit tag vote", tags: ["Units"] },
				},
				async ({ params, entity, authorization }) => {
					await checkUnitOwner(params.unitId, params.owner);
					await authorization.unit.ensureCanRead(params.unitId);
					const tagId = await runVoteTransaction(
						{ family: "unit_tag", authority: "global" },
						async (tx) => {
							const [application] = await tx
								.select({ tagId: unitTag.tagId })
								.from(unitTag)
								.where(and(eq(unitTag.unitId, params.unitId), eq(unitTag.tagId, params.tagId)))
								.limit(1);
							if (!application) throw new TagApplicationNotFound();
							const judgmentKey = and(
								eq(unitTagJudgment.unitId, params.unitId),
								eq(unitTagJudgment.tagId, application.tagId),
								eq(unitTagJudgment.profileId, entity.id),
							);
							await tx
								.delete(unitTagJudgment)
								.where(and(judgmentKey, isNull(unitTagJudgment.spoilerLevel)));
							await tx
								.update(unitTagJudgment)
								.set({ fitVote: null, fitUpdatedAt: null, updatedAt: new Date() })
								.where(and(judgmentKey, isNotNull(unitTagJudgment.spoilerLevel)));
							return application.tagId;
						},
					);
					return getTagVoteSummary(params.unitId, tagId, null);
				},
			),
	);
