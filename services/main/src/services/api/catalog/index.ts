import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { getEntityAssociationPolicy } from "../../authorization/entity/authorization";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	avatarReferenceFromColumns,
	isPrimaryUnitLocalization,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
} from "../../units/localization";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	auditEvent,
	creditAttribution,
	entity,
	entityAssociationPolicy,
	subjectAssociation,
	tag,
	unit,
	unitAlias,
	unitAliasVote,
	unitAliasVoteStat,
	unitAccessBinding,
	unitTagVote,
	unitLink,
	unitTag,
	unitTagVoteStat,
	unitLocalization,
	unitVariant,
} from "../../database/schema";
import { isCreditAttributionRoleForUnitKind } from "../../database/schema/contract-values";
import { AliasSearchScoreThreshold } from "../../database/schema/contract-values";
import {
	AddUnitAliasBody,
	AddUnitCreditBody,
	AddUnitSubjectAssociationBody,
	AddUnitLinkBody,
	CreateCatalogUnitBody,
	EntityDetailQuery,
	EntityLocalizationParams,
	ListEntityEntriesQuery,
	ListTagsQuery,
	TagUnitBody,
	UnitAssociationParams,
	UnitAliasParams,
	UnitAliasUnitParams,
	UnitUnitParams,
	UnitTagParams,
	UnitVersionParams,
	UpdateEntityAssociationPolicyBody,
	VoteBody,
} from "./schema";
import { checkUnitType, createCatalogUnit } from "./service";
import { upsertLocalization } from "../../units/service";
import { UnitLocalizationBody } from "../units/schema";
import { recordUnitRevision } from "../../units/history";
import { updateUnitVariantContext } from "../../units/variants";
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
	AliasListResponse,
	CreditAttributionResponse,
	EntityAssociationPolicyResponse,
	EntityDetailResponse,
	EntityListResponse,
	ExternalLinkResponse,
	SubjectAssociationResponse,
	TagApplicationResponse,
	TagListResponse,
	toPortableTextResponse,
	UnitVersionResponse,
	VoteResponse,
} from "../schema/response";
import { AliasNotFound, TagApplicationNotFound, UnitVersionNotFound } from "./errors";
import { TagNotFound } from "../tags/errors";
import {
	CreditAttributionNotFound,
	CreditAttributionRoleInvalid,
	EntityEntryNotFound,
	SubjectAssociationNotFound,
} from "../../entities/errors";
import { resolveEntityAssociationPolicy } from "../../authorization/entity/policy";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const CatalogUnitMutationNotFoundResponse = toApiErrorResponse([
	"UnitNotFound",
	"ImageAssetNotFound",
]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const UnitInteractionForbiddenResponse = toApiErrorResponse([
	"UnitAccessRestricted",
	"UnitPermissionForbidden",
]);
const EntityPolicyForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitAccessRestricted",
	"UnitProtected",
]);
const UnitVariantConflictResponse = toApiErrorResponse([
	"UnitVariantKindMismatch",
	"UnitVariantTargetIsVariant",
	"UnitVariantSourceHasVariants",
	"UnitVariantChanged",
	"UnitVariantMainUnavailable",
]);

const publiclyReadableUnitCondition = () =>
	and(
		eq(unit.status, "published"),
		eq(unit.visibility, "public"),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
	);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await authorization.ensureCanUpdate(unitId, [scope]);
}

async function getAliasVoteSummary(aliasId: string, value: number | null) {
	const [totals] = await database
		.select({ score: unitAliasVoteStat.score, voteCount: unitAliasVoteStat.voteCount })
		.from(unitAliasVoteStat)
		.where(eq(unitAliasVoteStat.aliasId, aliasId));
	return {
		value,
		score: toSafeInteger(totals?.score ?? 0n, "alias vote score"),
		voteCount: toSafeInteger(totals?.voteCount ?? 0n, "alias vote count"),
	};
}

function normalizeAliasTerm(term: string): string {
	return term.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

async function getTagVoteSummary(unitId: string, tagId: string, value: number | null) {
	const [totals] = await database
		.select({ score: unitTagVoteStat.score, voteCount: unitTagVoteStat.voteCount })
		.from(unitTagVoteStat)
		.where(and(eq(unitTagVoteStat.unitId, unitId), eq(unitTagVoteStat.tagId, tagId)));
	return {
		value,
		score: toSafeInteger(totals?.score ?? 0n, "tag vote score"),
		voteCount: toSafeInteger(totals?.voteCount ?? 0n, "tag vote count"),
	};
}

export default new Elysia()
	.use(session)
	.group("/entities", (app) =>
		app
			.get(
				"",
				async ({ query }) => {
					const items = await database
						.select({
							id: unit.id,
							kind: entity.kind,
							verified: entity.verified,
							avatar: resolvedUnitLocalizationAvatar(unit.id, query.language),
							bannerAssetId: resolvedUnitLocalizationImageAssetId(
								unit.id,
								"banner",
								query.language,
							),
							coverAssetId: resolvedUnitLocalizationImageAssetId(
								unit.id,
								"cover",
								query.language,
							),
							title: unitLocalization.title,
							summary: unitLocalization.summary,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
							),
						)
						.where(
							and(
								publiclyReadableUnitCondition(),
								query.kind ? eq(entity.kind, query.kind) : undefined,
							),
						)
						.orderBy(desc(unit.createdAt))
						.limit(query.limit ?? 20);
					return {
						items: items.map(({ avatar, bannerAssetId, coverAssetId, ...item }) => ({
							...item,
							kind: item.kind ?? "unknown",
							avatar: presentAvatar(avatar),
							banner: presentImageAsset(bannerAssetId),
							cover: presentImageAsset(coverAssetId),
						})),
					};
				},
				{
					query: ListEntityEntriesQuery,
					response: { [StatusCodes.OK]: EntityListResponse },
					detail: { summary: "List entity entries", tags: ["Entity"] },
				},
			)
			.post(
				"",
				async ({ profile, body }) => ({
					id: await createCatalogUnit("entity", profile.unitId, body),
				}),
				{
					access: "contribute:unit:create",
					body: CreateCatalogUnitBody,
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
					const identity = await resolveIdentity(request.headers, "unit:read");
					const [entry] = await database
						.select({
							id: unit.id,
							kind: entity.kind,
							verified: entity.verified,
							avatar: resolvedUnitLocalizationAvatar(unit.id, query.language),
							bannerAssetId: resolvedUnitLocalizationImageAssetId(
								unit.id,
								"banner",
								query.language,
							),
							coverAssetId: resolvedUnitLocalizationImageAssetId(
								unit.id,
								"cover",
								query.language,
							),
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.where(and(eq(entity.id, params.unitId), publiclyReadableUnitCondition()))
						.limit(1);
					if (!entry) throw new EntityEntryNotFound();
					const localizations = (
						await database
							.select()
							.from(unitLocalization)
							.where(eq(unitLocalization.unitId, params.unitId))
							.orderBy(asc(unitLocalization.position), asc(unitLocalization.language))
					).map((row) => ({
						unitId: row.unitId,
						language: row.language,
						position: row.position,
						title: row.title,
						summary: row.summary,
						description:
							row.description === null
								? null
								: toPortableTextResponse(row.description),
						avatar: presentAvatar(avatarReferenceFromColumns(row)),
						banner: presentImageAsset(row.bannerAssetId),
						cover: presentImageAsset(row.coverAssetId),
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
					}));
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
					const [owner] = await database
						.select({ profileId: unitAccessBinding.profileId })
						.from(unitAccessBinding)
						.where(
							and(
								eq(unitAccessBinding.unitId, params.unitId),
								eq(unitAccessBinding.subjectKind, "profile"),
								eq(unitAccessBinding.role, "owner"),
								isNull(unitAccessBinding.revokedAt),
								or(
									isNull(unitAccessBinding.expiresAt),
									sql`${unitAccessBinding.expiresAt} > now()`,
								),
							),
						)
						.limit(1);
					const { avatar, bannerAssetId, coverAssetId, ...entityEntry } = entry;
					const ownerSummary = owner?.profileId
						? ((await getPublicUnitSummariesByIds([owner.profileId])).get(
								owner.profileId,
							) ?? null)
						: null;
					const [canEdit, accessDecision, creditDecision, subjectDecision] =
						await Promise.all([
							identity.authorization.unit.canUpdate(params.unitId, ["localizations"]),
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
						]);
					return {
						...entityEntry,
						kind: entry.kind ?? "unknown",
						avatar: presentAvatar(avatar),
						banner: presentImageAsset(bannerAssetId),
						cover: presentImageAsset(coverAssetId),
						localizations,
						associationPolicy: await getEntityAssociationPolicy(params.unitId),
						owner: ownerSummary,
						capabilities: {
							canEdit,
							canManageAccess: accessDecision.allowed,
							canManageCreditAssociations: creditDecision.allowed,
							canManageSubjectAssociations: subjectDecision.allowed,
						},
						creditAttributions,
						subjectAssociations,
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
						[StatusCodes.NOT_FOUND]: CatalogUnitMutationNotFoundResponse,
					},
					detail: { summary: "Create or replace entity localization", tags: ["Entity"] },
				},
			)
			.get(
				"/:unitId/association-policy",
				async ({ params }) => getEntityAssociationPolicy(params.unitId),
				{
					params: UnitIdParams,
					response: {
						[StatusCodes.OK]: EntityAssociationPolicyResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EntityEntryNotFound"]),
					},
					detail: { summary: "Get Entity association policy", tags: ["Entity"] },
				},
			)
			.patch(
				"/:unitId/association-policy",
				async ({ params, body, profile, authorization }) => {
					const changes = [
						body.creditAttribution === undefined
							? undefined
							: { kind: "credit" as const, mode: body.creditAttribution },
						body.subjectAssociation === undefined
							? undefined
							: { kind: "subject" as const, mode: body.subjectAssociation },
					].filter((change) => change !== undefined);
					return database.transaction(async (tx) => {
						await authorization.entity.ensureCanManageAssociationPolicy(
							tx,
							params.unitId,
							changes.map((change) => change.kind),
						);
						for (const change of changes)
							await tx
								.insert(entityAssociationPolicy)
								.values({
									entityId: params.unitId,
									...change,
									updatedByProfileId: profile.unitId,
								})
								.onConflictDoUpdate({
									target: [
										entityAssociationPolicy.entityId,
										entityAssociationPolicy.kind,
									],
									set: {
										mode: change.mode,
										updatedByProfileId: profile.unitId,
									},
								});
						await tx.insert(auditEvent).values({
							actorProfileId: profile.unitId,
							action: "entity.association_policy.update",
							decisionCode: "allowed",
							subjectKind: "entity",
							subjectId: params.unitId,
							metadata: { changes },
						});
						return resolveEntityAssociationPolicy(
							await tx
								.select({
									kind: entityAssociationPolicy.kind,
									mode: entityAssociationPolicy.mode,
								})
								.from(entityAssociationPolicy)
								.where(eq(entityAssociationPolicy.entityId, params.unitId)),
						);
					});
				},
				{
					access: "session-only",
					params: UnitIdParams,
					body: UpdateEntityAssociationPolicyBody,
					response: {
						[StatusCodes.OK]: EntityAssociationPolicyResponse,
						[StatusCodes.FORBIDDEN]: EntityPolicyForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EntityEntryNotFound"]),
					},
					detail: { summary: "Update Entity association policy", tags: ["Entity"] },
				},
			),
	)
	.group("/tags", (app) =>
		app
			.get(
				"",
				async ({ query }) => ({
					items: await database
						.select({
							id: unit.id,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
						})
						.from(unit)
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								isPrimaryUnitLocalization(unitLocalization.unitId),
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
				}),
				{
					query: ListTagsQuery,
					response: { [StatusCodes.OK]: TagListResponse },
					detail: { summary: "List tags", tags: ["Tags"] },
				},
			)
			.post(
				"",
				async ({ profile, body }) => ({
					id: await createCatalogUnit("tag", profile.unitId, body),
				}),
				{
					access: "contribute:unit:create",
					body: CreateCatalogUnitBody,
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create tag", tags: ["Tags"] },
				},
			),
	)
	.group("/units/:type/:unitId", (app) =>
		app
			.get(
				"/aliases",
				async ({ params, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const rows = await database
						.select({
							id: unitAlias.id,
							unitId: unitAlias.unitId,
							term: unitAlias.term,
							normalizedTerm: unitAlias.normalizedTerm,
							language: unitAlias.language,
							kind: unitAlias.kind,
							createdByProfileId: unitAlias.createdByProfileId,
							score: unitAliasVoteStat.score,
							voteCount: unitAliasVoteStat.voteCount,
							searchable: sql<boolean>`coalesce(${unitAliasVoteStat.score}, 0) >= ${AliasSearchScoreThreshold}`,
							createdAt: unitAlias.createdAt,
							updatedAt: unitAlias.updatedAt,
						})
						.from(unitAlias)
						.leftJoin(unitAliasVoteStat, eq(unitAliasVoteStat.aliasId, unitAlias.id))
						.where(
							and(eq(unitAlias.unitId, params.unitId), isNull(unitAlias.deletedAt)),
						)
						.orderBy(
							desc(sql`coalesce(${unitAliasVoteStat.score}, 0)`),
							unitAlias.term,
						);
					return {
						items: rows.map((row) => ({
							...row,
							score: toSafeInteger(row.score ?? 0n, "alias vote score"),
							voteCount: toSafeInteger(row.voteCount ?? 0n, "alias vote count"),
						})),
					};
				},
				{
					access: "unit:read",
					params: UnitAliasUnitParams,
					response: { [StatusCodes.OK]: AliasListResponse },
					detail: { summary: "List Unit aliases", tags: ["Units"] },
				},
			)
			.post(
				"/aliases",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await authorization.unit.ensureCanRead(params.unitId);
					const term = body.term.trim();
					const normalizedTerm = normalizeAliasTerm(term);
					const result = await database.transaction(async (tx) => {
						const [created] = await tx
							.insert(unitAlias)
							.values({
								unitId: params.unitId,
								term,
								normalizedTerm,
								language: body.language,
								kind: body.kind,
								createdByProfileId: profile.unitId,
							})
							.returning();
						if (!created) throw new Error("Alias insertion did not return a row");
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return {
							...created,
							score: 0,
							voteCount: 0,
							searchable: false,
						};
					});
					return result;
				},
				{
					access: "contribute:unit:update",
					params: UnitAliasUnitParams,
					body: AddUnitAliasBody,
					response: {
						[StatusCodes.OK]: AliasResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Add Unit alias", tags: ["Units"] },
				},
			)
			.delete(
				"/aliases/:aliasId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"aliases",
					]);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.update(unitAlias)
							.set({ deletedAt: new Date() })
							.where(
								and(
									eq(unitAlias.id, params.aliasId),
									eq(unitAlias.unitId, params.unitId),
									isNull(unitAlias.deletedAt),
								),
							)
							.returning({ id: unitAlias.id });
						if (!deleted.length) throw new AliasNotFound();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:interaction:write",
					params: UnitAliasParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
					},
					detail: {
						summary: "Delete Unit alias",
						tags: ["Units"],
						responses: NoContentResponse,
					},
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
								isNull(unitAlias.deletedAt),
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
							set: { value: body.value },
						});
					return getAliasVoteSummary(params.aliasId, body.value);
				},
				{
					access: "contribute:unit:update",
					params: UnitAliasParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
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
								isNull(unitAlias.deletedAt),
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
					access: "write:unit:update",
					params: UnitAliasParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"AliasNotFound",
						]),
					},
					detail: { summary: "Remove Unit alias vote", tags: ["Units"] },
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
					params: UnitUnitParams,
					body: AddUnitCreditBody,
					response: {
						[StatusCodes.OK]: CreditAttributionResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"CreditAttributionRoleInvalid",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"UnitProtected",
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
					params: UnitAssociationParams,
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
					const association = await database.transaction(async (tx) => {
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
								...body,
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
						[StatusCodes.FORBIDDEN]: toApiErrorResponse([
							"UnitPermissionForbidden",
							"UnitProtected",
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
			.post(
				"/links",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"external-links",
					]);
					// A source link records evidence provenance, not credit or “is about” semantics.
					// It intentionally does not consume either Entity association capability.
					const normalized = new URL(body.url);
					normalized.hash = "";
					normalized.searchParams.sort();
					const normalizedUrl = normalized.toString();
					const link = await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.unitId}::text, 0))`,
						);
						const [last] = await tx
							.select({ position: unitLink.position })
							.from(unitLink)
							.where(eq(unitLink.unitId, params.unitId))
							.orderBy(desc(unitLink.position), desc(unitLink.id))
							.limit(1);
						const [created] = await tx
							.insert(unitLink)
							.values({
								unitId: params.unitId,
								sourceEntityId: body.sourceEntityUnitId,
								url: body.url,
								role: body.role,
								position:
									body.position ??
									fractionalPositionBetween(last?.position, null),
								normalizedUrl,
								normalizedUrlHash: createHash("sha256")
									.update(normalizedUrl)
									.digest("hex"),
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							event: "update",
						});
						return created;
					});
					if (!link) throw new Error("External link insertion did not return a row");
					return link;
				},
				{
					access: "contribute:unit:update",
					params: UnitUnitParams,
					body: AddUnitLinkBody,
					response: {
						[StatusCodes.OK]: ExternalLinkResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Add unit source link", tags: ["Units"] },
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
			.delete(
				"/tags/:tagId",
				async ({ params, profile, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, ["tags"]);
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
			)
			.put(
				"/version-of/:canonicalId",
				async ({ params, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await checkUnitType(params.canonicalId, params.type);
					const [current] = await database
						.select({ mainUnitId: unitVariant.mainUnitId })
						.from(unitVariant)
						.where(eq(unitVariant.variantUnitId, params.unitId))
						.limit(1);
					await updateUnitVariantContext({
						kind: params.type,
						variantUnitId: params.unitId,
						mainUnitId: params.canonicalId,
						expectedMainUnitId: current?.mainUnitId ?? null,
						actorProfileId: authorization.profileId,
						authorization: authorization.unit,
					});
					const [relationship] = await database
						.select()
						.from(unitVariant)
						.where(eq(unitVariant.variantUnitId, params.unitId))
						.limit(1);
					if (!relationship) throw new UnitVersionNotFound();
					return {
						unitId: relationship.variantUnitId,
						canonicalUnitId: relationship.mainUnitId,
						createdAt: relationship.createdAt,
						updatedAt: relationship.updatedAt,
					};
				},
				{
					access: "contribute:unit:update",
					params: UnitVersionParams,
					response: {
						[StatusCodes.OK]: UnitVersionResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"UnitVersionNotFound",
						]),
						[StatusCodes.CONFLICT]: UnitVariantConflictResponse,
					},
					detail: {
						summary: "Attach unit version (legacy)",
						tags: ["Units"],
						deprecated: true,
					},
				},
			),
	);
