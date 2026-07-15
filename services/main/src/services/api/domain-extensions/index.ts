import { StatusCodes } from "http-status-codes";
import { and, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { PortableText } from "@rezics/portable-text";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { database } from "../../database";
import {
	game,
	gameRequirement,
	series,
	seriesRelease,
	unit,
	unitCollaborator,
	unitLink,
	unitLocalization,
	zone,
	zonePage,
	zoneSubscription,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { FollowResponse, IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	CreateSeriesBody,
	CreateZoneBody,
	GameParams,
	GameRequirementParams,
	SeriesParams,
	SeriesReleaseListResponse,
	SeriesReleaseParams,
	SeriesReleaseResponse,
	SystemRequirementBody,
	SystemRequirementListResponse,
	SystemRequirementResponse,
	UpsertSeriesReleaseBody,
	ZonePageBody,
	ZonePageListResponse,
	ZonePageParams,
	ZonePageResponse,
	ZoneParams,
} from "./schema";
import {
	GameNotFound,
	GameSystemRequirementSourceInvalid,
	SeriesReleaseNotFound,
	SeriesReleaseRangeInvalid,
	SystemRequirementNotFound,
	ZonePageNotFound,
} from "./errors";

const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitEditForbidden", "UnitFieldLocked"]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	path: string,
): Promise<void> {
	await authorization.ensureCanEdit(unitId);
	await authorization.ensureFieldsUnlocked(unitId, [path]);
}

async function createBaseUnit(
	tx: DatabaseTransaction,
	input: {
		kind: "series" | "zone";
		slug?: string;
		localization: {
			language: string;
			title: string;
			summary?: string;
			description?: PortableText;
		};
		ownerId: string;
	},
) {
	const stem = input.localization.title
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 56);
	const slug = input.slug ?? `${stem || "unit"}-${crypto.randomUUID().slice(0, 8)}`;
	const [created] = await tx
		.insert(unit)
		.values({
			kind: input.kind,
			slug,
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
		})
		.returning({ id: unit.id });
	if (!created) throw new Error("Unit insertion did not return an id");
	await tx
		.insert(unitLocalization)
		.values({ unitId: created.id, ...input.localization, isDefault: true });
	await tx.insert(unitCollaborator).values({
		unitId: created.id,
		profileId: input.ownerId,
		role: "owner",
		addedByProfileId: input.ownerId,
	});
	return created.id;
}

async function ensureRequirementSource(gameId: string, sourceExternalLinkId?: string | null) {
	if (!sourceExternalLinkId) return;
	const [source] = await database
		.select({ id: unitLink.id })
		.from(unitLink)
		.where(and(eq(unitLink.id, sourceExternalLinkId), eq(unitLink.unitId, gameId)))
		.limit(1);
	if (!source) throw new GameSystemRequirementSourceInvalid();
}

export default new Elysia()
	.use(session)
	.group("/series", (app) =>
		app
			.post(
				"",
				async ({ profile, body }) => {
					const id = await database.transaction(async (tx) => {
						const unitId = await createBaseUnit(tx, {
							kind: "series",
							slug: body.slug,
							localization: body.localization,
							ownerId: profile.unitId,
						});
						await tx.insert(series).values({ id: unitId, kind: body.kind });
						await recordUnitRevision(tx, {
							unitId,
							actorProfileId: profile.unitId,
							event: "create",
						});
						return unitId;
					});
					return { id };
				},
				{
					contribute: true,
					body: CreateSeriesBody,
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create Series", tags: ["Series"] },
				},
			)
			.get(
				"/:seriesId/releases",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers)).authorization;
					await authorization.unit.ensureCanRead(
						params.seriesId,
						() => new UnitNotFound("Series"),
					);
					return {
						items: await database
							.select()
							.from(seriesRelease)
							.where(eq(seriesRelease.seriesId, params.seriesId))
							.orderBy(seriesRelease.position, seriesRelease.releaseUnitId),
					};
				},
				{
					params: SeriesParams,
					response: {
						[StatusCodes.OK]: SeriesReleaseListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Series releases", tags: ["Series"] },
				},
			)
			.put(
				"/:seriesId/releases/:releaseId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.seriesId,
						"/releases",
					);
					await authorization.unit.ensureCanRead(
						params.releaseId,
						() => new UnitNotFound("Release Unit"),
					);
					const [created] = await database.transaction(async (tx) => {
						const rows = await tx
							.insert(seriesRelease)
							.values({
								seriesId: params.seriesId,
								releaseUnitId: params.releaseId,
								...body,
							})
							.onConflictDoUpdate({
								target: [seriesRelease.seriesId, seriesRelease.releaseUnitId],
								set: body,
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.seriesId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return rows;
					});
					if (!created) throw new Error("Series release upsert did not return a row");
					return created;
				},
				{
					contribute: true,
					params: SeriesReleaseParams,
					body: UpsertSeriesReleaseBody,
					response: {
						[StatusCodes.OK]: SeriesReleaseResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Add or update Series release", tags: ["Series"] },
				},
			)
			.delete(
				"/:seriesId/releases/:releaseId",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.seriesId,
						"/releases",
					);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(seriesRelease)
							.where(
								and(
									eq(seriesRelease.seriesId, params.seriesId),
									eq(seriesRelease.releaseUnitId, params.releaseId),
								),
							)
							.returning({ id: seriesRelease.releaseUnitId });
						if (!deleted.length) throw new SeriesReleaseNotFound();
						await recordUnitRevision(tx, {
							unitId: params.seriesId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					write: true,
					params: SeriesReleaseParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SeriesReleaseNotFound",
						]),
					},
					detail: {
						summary: "Remove Series release",
						tags: ["Series"],
						responses: NoContentResponse,
					},
				},
			),
	)
	.group("/zones", (app) =>
		app
			.post(
				"",
				async ({ profile, authorization, body }) => {
					await authorization.realm.ensureCapability(
						body.ownerRealmId,
						"realm.settings.update",
					);
					const startsAt = body.startsAt ? new Date(body.startsAt) : null;
					const endsAt = body.endsAt ? new Date(body.endsAt) : null;
					if (startsAt && endsAt && endsAt <= startsAt)
						throw new SeriesReleaseRangeInvalid();
					const id = await database.transaction(async (tx) => {
						const unitId = await createBaseUnit(tx, {
							kind: "zone",
							slug: body.slug,
							localization: body.localization,
							ownerId: profile.unitId,
						});
						await tx.insert(zone).values({
							id: unitId,
							ownerRealmId: body.ownerRealmId,
							boundary: body.boundary,
							nav: body.nav,
							theme: body.theme,
							startsAt,
							endsAt,
						});
						await recordUnitRevision(tx, {
							unitId,
							actorProfileId: profile.unitId,
							event: "create",
						});
						return unitId;
					});
					return { id };
				},
				{
					contribute: true,
					body: CreateZoneBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"SeriesReleaseRangeInvalid",
						]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
					},
					detail: { summary: "Create Zone", tags: ["Zones"] },
				},
			)
			.get(
				"/:zoneId/pages",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers)).authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					return {
						items: await database
							.select()
							.from(zonePage)
							.where(eq(zonePage.zoneId, params.zoneId))
							.orderBy(zonePage.position, zonePage.id),
					};
				},
				{
					params: ZoneParams,
					response: {
						[StatusCodes.OK]: ZonePageListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Zone pages", tags: ["Zones"] },
				},
			)
			.post(
				"/:zoneId/pages",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, "/pages");
					const [created] = await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.zoneId}::text, 0))`,
						);
						if (body.home)
							await tx
								.update(zonePage)
								.set({ home: false })
								.where(eq(zonePage.zoneId, params.zoneId));
						const rows = await tx
							.insert(zonePage)
							.values({ zoneId: params.zoneId, ...body })
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return rows;
					});
					if (!created) throw new Error("Zone page insertion did not return a row");
					return created;
				},
				{
					contribute: true,
					params: ZoneParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Create Zone page", tags: ["Zones"] },
				},
			)
			.put(
				"/:zoneId/pages/:pageId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, "/pages");
					return database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${params.zoneId}::text, 0))`,
						);
						if (body.home)
							await tx
								.update(zonePage)
								.set({ home: false })
								.where(
									and(
										eq(zonePage.zoneId, params.zoneId),
										sql`${zonePage.id} <> ${params.pageId}`,
									),
								);
						const rows = await tx
							.update(zonePage)
							.set(body)
							.where(
								and(
									eq(zonePage.id, params.pageId),
									eq(zonePage.zoneId, params.zoneId),
								),
							)
							.returning();
						const [updated] = rows;
						if (!updated) throw new ZonePageNotFound();
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return updated;
					});
				},
				{
					contribute: true,
					params: ZonePageParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
					},
					detail: { summary: "Replace Zone page", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/pages/:pageId",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, "/pages");
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(zonePage)
							.where(
								and(
									eq(zonePage.id, params.pageId),
									eq(zonePage.zoneId, params.zoneId),
								),
							)
							.returning({ id: zonePage.id });
						if (!deleted.length) throw new ZonePageNotFound();
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					write: true,
					params: ZonePageParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
					},
					detail: {
						summary: "Delete Zone page",
						tags: ["Zones"],
						responses: NoContentResponse,
					},
				},
			)
			.put(
				"/:zoneId/follow",
				async ({ params, profile, authorization }) => {
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await database
						.insert(zoneSubscription)
						.values({ profileId: profile.unitId, zoneId: params.zoneId })
						.onConflictDoNothing();
					return { following: true };
				},
				{
					write: true,
					params: ZoneParams,
					response: {
						[StatusCodes.OK]: FollowResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Follow Zone", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/follow",
				async ({ params, profile }) => {
					await database
						.delete(zoneSubscription)
						.where(
							and(
								eq(zoneSubscription.profileId, profile.unitId),
								eq(zoneSubscription.zoneId, params.zoneId),
							),
						);
					return { following: false };
				},
				{
					write: true,
					params: ZoneParams,
					response: { [StatusCodes.OK]: FollowResponse },
					detail: { summary: "Unfollow Zone", tags: ["Zones"] },
				},
			),
	)
	.group("/games", (app) =>
		app
			.get(
				"/:gameId/system-requirements",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers)).authorization;
					await authorization.unit.ensureCanRead(
						params.gameId,
						() => new UnitNotFound("Game"),
					);
					return {
						items: await database
							.select()
							.from(gameRequirement)
							.where(eq(gameRequirement.gameId, params.gameId))
							.orderBy(
								gameRequirement.platformEntityId,
								gameRequirement.tier,
								gameRequirement.language,
								gameRequirement.id,
							),
					};
				},
				{
					params: GameParams,
					response: {
						[StatusCodes.OK]: SystemRequirementListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Game system requirements", tags: ["Games"] },
				},
			)
			.post(
				"/:gameId/system-requirements",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.gameId,
						"/systemRequirements",
					);
					await ensureRequirementSource(params.gameId, body.sourceLinkId);
					const [gameRecord] = await database
						.select({ id: game.id })
						.from(game)
						.where(eq(game.id, params.gameId))
						.limit(1);
					if (!gameRecord) throw new GameNotFound();
					const [created] = await database.transaction(async (tx) => {
						const rows = await tx
							.insert(gameRequirement)
							.values({
								gameId: params.gameId,
								platformEntityId: body.platformEntityId,
								tier: body.tier,
								language: body.language,
								sourceLinkId: body.sourceLinkId,
								hardware: body.hardware,
								rawText: body.rawText,
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.gameId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return rows;
					});
					if (!created)
						throw new Error("System requirement insertion did not return a row");
					return created;
				},
				{
					contribute: true,
					params: GameParams,
					body: SystemRequirementBody,
					response: {
						[StatusCodes.OK]: SystemRequirementResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"GameSystemRequirementSourceInvalid",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"GameNotFound",
						]),
					},
					detail: { summary: "Create Game system requirement", tags: ["Games"] },
				},
			)
			.put(
				"/:gameId/system-requirements/:requirementId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.gameId,
						"/systemRequirements",
					);
					await ensureRequirementSource(params.gameId, body.sourceLinkId);
					return database.transaction(async (tx) => {
						const rows = await tx
							.update(gameRequirement)
							.set({
								platformEntityId: body.platformEntityId,
								tier: body.tier,
								language: body.language,
								sourceLinkId: body.sourceLinkId,
								hardware: body.hardware,
								rawText: body.rawText,
							})
							.where(
								and(
									eq(gameRequirement.id, params.requirementId),
									eq(gameRequirement.gameId, params.gameId),
								),
							)
							.returning();
						const [updated] = rows;
						if (!updated) throw new SystemRequirementNotFound();
						await recordUnitRevision(tx, {
							unitId: params.gameId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return updated;
					});
				},
				{
					contribute: true,
					params: GameRequirementParams,
					body: SystemRequirementBody,
					response: {
						[StatusCodes.OK]: SystemRequirementResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"GameSystemRequirementSourceInvalid",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SystemRequirementNotFound",
						]),
					},
					detail: { summary: "Replace Game system requirement", tags: ["Games"] },
				},
			)
			.delete(
				"/:gameId/system-requirements/:requirementId",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.gameId,
						"/systemRequirements",
					);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(gameRequirement)
							.where(
								and(
									eq(gameRequirement.id, params.requirementId),
									eq(gameRequirement.gameId, params.gameId),
								),
							)
							.returning({ id: gameRequirement.id });
						if (!deleted.length) throw new SystemRequirementNotFound();
						await recordUnitRevision(tx, {
							unitId: params.gameId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					write: true,
					params: GameRequirementParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SystemRequirementNotFound",
						]),
					},
					detail: {
						summary: "Delete Game system requirement",
						tags: ["Games"],
						responses: NoContentResponse,
					},
				},
			),
	);
