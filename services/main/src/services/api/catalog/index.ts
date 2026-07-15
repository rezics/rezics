import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";

import { and, count, desc, eq, sum } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { database } from "../../database";
import {
	unitCredit,
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
import {
	AddUnitAliasBody,
	AddUnitCreditBody,
	AddUnitLinkBody,
	CreateCatalogUnitBody,
	ListEntityEntriesQuery,
	ListTagsQuery,
	TagUnitBody,
	UnitAliasParams,
	UnitUnitParams,
	UnitTagParams,
	UnitVersionParams,
	VoteBody,
} from "./schema";
import { checkUnitType, createCatalogUnit } from "./service";
import { recordUnitRevision } from "../../units/history";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { UnitIdParams } from "../schema";
import {
	toApiErrorResponse,
	AliasResponse,
	CreditAttributionResponse,
	EntityDetailResponse,
	EntityListResponse,
	ExternalLinkResponse,
	TagApplicationResponse,
	TagListResponse,
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
const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitEditForbidden", "UnitFieldLocked"]);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	path: string,
): Promise<void> {
	await authorization.ensureCanEdit(unitId);
	await authorization.ensureFieldsUnlocked(unitId, [path]);
}

async function getAliasVoteSummary(aliasId: string, value: number | null) {
	const [totals] = await database
		.select({ score: sum(unitAliasVote.value), voteCount: count() })
		.from(unitAliasVote)
		.where(eq(unitAliasVote.aliasId, aliasId));
	return { value, score: Number(totals?.score ?? 0), voteCount: totals?.voteCount ?? 0 };
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
							avatar: entity.avatar,
							title: unitLocalization.title,
							summary: unitLocalization.summary,
						})
						.from(entity)
						.innerJoin(unit, eq(unit.id, entity.id))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								eq(unitLocalization.isDefault, true),
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
						items: items.map((item) => ({ ...item, kind: item.kind ?? "unknown" })),
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
					contribute: true,
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
							avatar: entity.avatar,
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
					).map(({ unitId, ...row }) => ({ unitId: unitId, ...row }));
					const credits = await database
						.select({
							unitId: unitCredit.unitId,
							role: unitCredit.role,
						})
						.from(unitCredit)
						.where(eq(unitCredit.entityId, params.unitId));
					return { ...entry, kind: entry.kind ?? "unknown", localizations, credits };
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
								eq(unitLocalization.isDefault, true),
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
					contribute: true,
					body: CreateCatalogUnitBody,
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create tag", tags: ["Tags"] },
				},
			),
	)
	.group("/units/:type/:unitId", (app) =>
		app
			.post(
				"/aliases",
				async ({ params, profile, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.unitId,
						"/aliases",
					);
					const normalizedValue = body.value.trim().normalize("NFKC").toLocaleLowerCase();
					const result = await database.transaction(async (tx) => {
						const [created] = await tx
							.insert(unitAlias)
							.values({
								unitId: params.unitId,
								value: body.value.trim(),
								normalizedValue,
								language: body.language,
								kind: body.kind,
								pinned: body.pinned,
								position: body.position,
								createdByProfileId: profile.unitId,
							})
							.returning();
						if (!created) throw new Error("Alias insertion did not return a row");
						await recordUnitRevision(tx, {
							unitId: params.unitId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return created;
					});
					return result;
				},
				{
					contribute: true,
					params: UnitUnitParams,
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
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.unitId,
						"/aliases",
					);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(unitAlias)
							.where(
								and(
									eq(unitAlias.id, params.aliasId),
									eq(unitAlias.unitId, params.unitId),
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
					write: true,
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
					await authorization.unit.ensureCanRead(params.unitId);
					const [target] = await database
						.select({ id: unitAlias.id })
						.from(unitAlias)
						.where(
							and(
								eq(unitAlias.id, params.aliasId),
								eq(unitAlias.unitId, params.unitId),
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
					contribute: true,
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
				async ({ params, profile }) => {
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
					write: true,
					params: UnitAliasParams,
					response: { [StatusCodes.OK]: VoteResponse },
					detail: { summary: "Remove Unit alias vote", tags: ["Units"] },
				},
			)
			.post(
				"/credits",
				async ({ params, authorization, body }) => {
					await checkUnitType(params.unitId, params.type);
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.unitId,
						"/credits",
					);
					const credit = await database.transaction(async (tx) => {
						const [created] = await tx
							.insert(unitCredit)
							.values({ unitId: params.unitId, ...body })
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
					contribute: true,
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
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.unitId,
						"/externalLinks",
					);
					const normalized = new URL(body.url);
					normalized.hash = "";
					normalized.searchParams.sort();
					const normalizedUrl = normalized.toString();
					const link = await database.transaction(async (tx) => {
						const [created] = await tx
							.insert(unitLink)
							.values({
								unitId: params.unitId,
								sourceEntityId: body.sourceEntityUnitId,
								url: body.url,
								role: body.role,
								label: body.label,
								position: body.position,
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
					contribute: true,
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
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, "/tags");
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
					contribute: true,
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
					await ensureUnitMutationAuthorized(authorization.unit, params.unitId, "/tags");
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
					write: true,
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
					contribute: true,
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
					write: true,
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
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.unitId,
						"/variant",
					);
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
					contribute: true,
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
