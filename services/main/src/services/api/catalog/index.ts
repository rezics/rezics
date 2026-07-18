import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";

import { and, count, desc, eq, isNull, sql, sum } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { database } from "../../database";
import { isPrimaryUnitLocalization } from "../../units/localization";
import { fractionalPositionBetween } from "../../ordering/position";
import {
	creditAttribution,
	entity,
	unit,
	unitAlias,
	unitAliasVote,
	unitTagVote,
	unitLink,
	unitTag,
	unitLocalization,
	unitVariant,
} from "../../database/schema";
import { AliasSearchScoreThreshold } from "../../database/schema/contract-values";
import {
	AddUnitAliasBody,
	AddUnitCreditBody,
	AddUnitLinkBody,
	CreateCatalogUnitBody,
	ListEntityEntriesQuery,
	ListTagsQuery,
	TagUnitBody,
	UnitAliasParams,
	UnitAliasUnitParams,
	UnitUnitParams,
	UnitTagParams,
	UnitVersionParams,
	VoteBody,
} from "./schema";
import { checkUnitType, createCatalogUnit } from "./service";
import { recordUnitRevision } from "../../units/history";
import { presentImageAsset } from "../../units/service";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { UnitIdParams } from "../schema";
import {
	toApiErrorResponse,
	AliasResponse,
	AliasListResponse,
	CreditAttributionResponse,
	EntityDetailResponse,
	EntityListResponse,
	ExternalLinkResponse,
	TagApplicationResponse,
	TagListResponse,
	toPortableTextResponse,
	UnitVersionResponse,
	VoteResponse,
} from "../schema/response";
import {
	AliasNotFound,
	EntityEntryNotFound,
	TagApplicationNotFound,
	UnitVersionNotFound,
} from "./errors";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await authorization.ensureCanUpdate(unitId, [scope]);
}

async function getAliasVoteSummary(aliasId: string, value: number | null) {
	const [totals] = await database
		.select({ score: sum(unitAliasVote.value), voteCount: count() })
		.from(unitAliasVote)
		.where(eq(unitAliasVote.aliasId, aliasId));
	return { value, score: Number(totals?.score ?? 0), voteCount: totals?.voteCount ?? 0 };
}

function normalizeAliasTerm(term: string): string {
	return term.trim().normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
}

async function getTagVoteSummary(unitId: string, tagId: string, value: number | null) {
	const [totals] = await database
		.select({ score: sum(unitTagVote.value), voteCount: count() })
		.from(unitTagVote)
		.where(and(eq(unitTagVote.unitId, unitId), eq(unitTagVote.tagId, tagId)));
	return { value, score: Number(totals?.score ?? 0), voteCount: totals?.voteCount ?? 0 };
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
							slug: unit.slug,
							kind: entity.kind,
							verified: entity.verified,
							avatarAssetId: entity.avatarAssetId,
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
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
								query.kind ? eq(entity.kind, query.kind) : undefined,
							),
						)
						.orderBy(desc(unit.createdAt))
						.limit(query.limit ?? 20);
					return {
						items: items.map(({ avatarAssetId, ...item }) => ({
							...item,
							kind: item.kind ?? "unknown",
							avatar: presentImageAsset(avatarAssetId)?.url ?? null,
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
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create entity entry", tags: ["Entity"] },
				},
			)
			.get(
				"/:unitId",
				async ({ params }) => {
					const [entry] = await database
						.select({
							id: unit.id,
							slug: unit.slug,
							kind: entity.kind,
							verified: entity.verified,
							avatarAssetId: entity.avatarAssetId,
							createdAt: unit.createdAt,
							updatedAt: unit.updatedAt,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.where(
							and(
								eq(entity.id, params.unitId),
								eq(unit.status, "published"),
								eq(unit.visibility, "public"),
							),
						)
						.limit(1);
					if (!entry) throw new EntityEntryNotFound();
					const localizations = (
						await database
							.select()
							.from(unitLocalization)
							.where(eq(unitLocalization.unitId, params.unitId))
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
						cover: presentImageAsset(row.coverAssetId),
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
					}));
					const credits = await database
						.select({
							unitId: creditAttribution.unitId,
							role: creditAttribution.role,
						})
						.from(creditAttribution)
						.where(eq(creditAttribution.entityId, params.unitId));
					const { avatarAssetId, ...entityEntry } = entry;
					return {
						...entityEntry,
						kind: entry.kind ?? "unknown",
						avatar: presentImageAsset(avatarAssetId)?.url ?? null,
						localizations,
						credits,
					};
				},
				{
					params: UnitIdParams,
					response: {
						[StatusCodes.OK]: EntityDetailResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["EntityEntryNotFound"]),
					},
					detail: { summary: "Get entity entry", tags: ["Entity"] },
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
							slug: unit.slug,
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
					const items = await database
						.select({
							id: unitAlias.id,
							unitId: unitAlias.unitId,
							term: unitAlias.term,
							normalizedTerm: unitAlias.normalizedTerm,
							language: unitAlias.language,
							kind: unitAlias.kind,
							createdByProfileId: unitAlias.createdByProfileId,
							score: sql<number>`coalesce((select sum(${unitAliasVote.value}) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id}), 0)::int`,
							voteCount: sql<number>`(select count(*) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id})::int`,
							searchable: sql<boolean>`coalesce((select sum(${unitAliasVote.value}) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id}), 0) >= ${AliasSearchScoreThreshold}`,
							createdAt: unitAlias.createdAt,
							updatedAt: unitAlias.updatedAt,
						})
						.from(unitAlias)
						.where(
							and(eq(unitAlias.unitId, params.unitId), isNull(unitAlias.deletedAt)),
						)
						.orderBy(
							desc(
								sql`coalesce((select sum(${unitAliasVote.value}) from ${unitAliasVote} where ${unitAliasVote.aliasId} = ${unitAlias.id}), 0)`,
							),
							unitAlias.term,
						);
					return { items };
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
				"/credits",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"credits",
					]);
					const credit = await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.unitId}::text, 0))`,
						);
						const [last] = await tx
							.select({ position: creditAttribution.position })
							.from(creditAttribution)
							.where(eq(creditAttribution.unitId, params.unitId))
							.orderBy(desc(creditAttribution.position), desc(creditAttribution.id))
							.limit(1);
						const [created] = await tx
							.insert(creditAttribution)
							.values({
								unitId: params.unitId,
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
					return credit;
				},
				{
					access: "contribute:unit:update",
					params: UnitUnitParams,
					body: AddUnitCreditBody,
					response: {
						[StatusCodes.OK]: CreditAttributionResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Add unit credit", tags: ["Units"] },
				},
			)
			.post(
				"/links",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"external-links",
					]);
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
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, ["tags"]);
					await database.transaction(async (tx) => {
						await tx
							.insert(unitTag)
							.values({ unitId: params.unitId, tagId: params.tagId })
							.onConflictDoNothing();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							event: "update",
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
					return { ...application, score: 0, voteCount: 0 };
				},
				{
					access: "contribute:unit:update",
					params: UnitTagParams,
					body: TagUnitBody,
					response: {
						[StatusCodes.OK]: TagApplicationResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
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
					access: "write:interaction:write",
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
							set: { value: body.value },
						});
					return getTagVoteSummary(params.unitId, application.tagId, body.value);
				},
				{
					access: "contribute:unit:update",
					params: UnitTagParams,
					body: VoteBody,
					response: {
						[StatusCodes.OK]: VoteResponse,
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
				async ({ params, profile }) => {
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
					access: "write:unit:update",
					params: UnitTagParams,
					response: {
						[StatusCodes.OK]: VoteResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["TagApplicationNotFound"]),
					},
					detail: { summary: "Remove Unit tag vote", tags: ["Units"] },
				},
			)
			.put(
				"/version-of/:canonicalId",
				async ({ params, authorization }) => {
					await checkUnitType(params.unitId, params.type);
					await checkUnitType(params.canonicalId, params.type);
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, [
						"variant",
					]);
					return database.transaction(async (tx) => {
						const [created] = await tx
							.insert(unitVariant)
							.values({
								unitId: params.unitId,
								canonicalUnitId: params.canonicalId,
							})
							.onConflictDoUpdate({
								target: unitVariant.unitId,
								set: {
									canonicalUnitId: params.canonicalId,
								},
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: authorization.profileId,
							event: "update",
						});
						if (!created) throw new UnitVersionNotFound();
						return created;
					});
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
					},
					detail: { summary: "Attach unit version", tags: ["Units"] },
				},
			),
	);
