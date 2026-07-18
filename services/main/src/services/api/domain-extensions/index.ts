import { StatusCodes } from "http-status-codes";
import { and, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { type PortableTextDocument } from "@rezics/content-structure";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { database } from "../../database";
import {
	software,
	softwareRequirement,
	series,
	seriesRelease,
	unit,
	unitCollaborator,
	unitLink,
	unitLocalization,
	zone,
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
	SoftwareParams,
	SoftwareRequirementParams,
	SeriesParams,
	SeriesReleaseListResponse,
	SeriesReleaseParams,
	SeriesReleaseResponse,
	SystemRequirementBody,
	SystemRequirementListResponse,
	SystemRequirementResponse,
	UpsertSeriesReleaseBody,
	ZoneParams,
} from "./schema";
import {
	SoftwareNotFound,
	SoftwareSystemRequirementSourceInvalid,
	SeriesReleaseNotFound,
	SystemRequirementNotFound,
	ZoneTimeRangeInvalid,
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
			description?: PortableTextDocument;
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

async function ensureRequirementSource(softwareId: string, sourceExternalLinkId?: string | null) {
	if (!sourceExternalLinkId) return;
	const [source] = await database
		.select({ id: unitLink.id })
		.from(unitLink)
		.where(and(eq(unitLink.id, sourceExternalLinkId), eq(unitLink.unitId, softwareId)))
		.limit(1);
	if (!source) throw new SoftwareSystemRequirementSourceInvalid();
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
					access: "contribute:unit:create",
					body: CreateSeriesBody,
					response: { [StatusCodes.OK]: IdResponse },
					detail: { summary: "Create Series", tags: ["Series"] },
				},
			)
			.get(
				"/:seriesId/releases",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
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
					access: "contribute:unit:update",
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
					access: "write:unit:delete",
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
					if (body.managingRealmId)
						await authorization.realm.ensureCapability(
							body.managingRealmId,
							"realm.settings.update",
						);
					const startsAt = body.startsAt ? new Date(body.startsAt) : null;
					const endsAt = body.endsAt ? new Date(body.endsAt) : null;
					if (startsAt && endsAt && endsAt <= startsAt) throw new ZoneTimeRangeInvalid();
					const id = await database.transaction(async (tx) => {
						const unitId = await createBaseUnit(tx, {
							kind: "zone",
							slug: body.slug,
							localization: body.localization,
							ownerId: profile.unitId,
						});
						await tx.insert(zone).values({
							id: unitId,
							managingRealmId: body.managingRealmId,
							boundaryDocument: body.boundaryDocument,
							themeDocument: body.themeDocument,
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
					access: "contribute:unit:create",
					body: CreateZoneBody,
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneTimeRangeInvalid"]),
						[StatusCodes.FORBIDDEN]: toApiErrorResponse(["RealmCapabilityRequired"]),
					},
					detail: { summary: "Create Zone", tags: ["Zones"] },
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
					access: "write:unit:update",
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
					access: "write:unit:delete",
					params: ZoneParams,
					response: { [StatusCodes.OK]: FollowResponse },
					detail: { summary: "Unfollow Zone", tags: ["Zones"] },
				},
			),
	)
	.group("/software", (app) =>
		app
			.get(
				"/:softwareId/system-requirements",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.softwareId,
						() => new UnitNotFound("Software"),
					);
					return {
						items: await database
							.select()
							.from(softwareRequirement)
							.where(eq(softwareRequirement.softwareId, params.softwareId))
							.orderBy(
								softwareRequirement.platformEntityId,
								softwareRequirement.tier,
								softwareRequirement.id,
							),
					};
				},
				{
					params: SoftwareParams,
					response: {
						[StatusCodes.OK]: SystemRequirementListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Software system requirements", tags: ["Software"] },
				},
			)
			.post(
				"/:softwareId/system-requirements",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.softwareId,
						"/systemRequirements",
					);
					await ensureRequirementSource(params.softwareId, body.sourceLinkId);
					const [softwareRecord] = await database
						.select({ id: software.id })
						.from(software)
						.where(eq(software.id, params.softwareId))
						.limit(1);
					if (!softwareRecord) throw new SoftwareNotFound();
					const [created] = await database.transaction(async (tx) => {
						const rows = await tx
							.insert(softwareRequirement)
							.values({
								softwareId: params.softwareId,
								platformEntityId: body.platformEntityId,
								tier: body.tier,
								sourceLinkId: body.sourceLinkId,
								hardware: body.hardware,
							})
							.returning();
						await recordUnitRevision(tx, {
							unitId: params.softwareId,
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
					access: "contribute:unit:update",
					params: SoftwareParams,
					body: SystemRequirementBody,
					response: {
						[StatusCodes.OK]: SystemRequirementResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"SoftwareSystemRequirementSourceInvalid",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SoftwareNotFound",
						]),
					},
					detail: { summary: "Create Software system requirement", tags: ["Software"] },
				},
			)
			.put(
				"/:softwareId/system-requirements/:requirementId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.softwareId,
						"/systemRequirements",
					);
					await ensureRequirementSource(params.softwareId, body.sourceLinkId);
					return database.transaction(async (tx) => {
						const rows = await tx
							.update(softwareRequirement)
							.set({
								platformEntityId: body.platformEntityId,
								tier: body.tier,
								sourceLinkId: body.sourceLinkId,
								hardware: body.hardware,
							})
							.where(
								and(
									eq(softwareRequirement.id, params.requirementId),
									eq(softwareRequirement.softwareId, params.softwareId),
								),
							)
							.returning();
						const [updated] = rows;
						if (!updated) throw new SystemRequirementNotFound();
						await recordUnitRevision(tx, {
							unitId: params.softwareId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return updated;
					});
				},
				{
					access: "contribute:unit:update",
					params: SoftwareRequirementParams,
					body: SystemRequirementBody,
					response: {
						[StatusCodes.OK]: SystemRequirementResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"SoftwareSystemRequirementSourceInvalid",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SystemRequirementNotFound",
						]),
					},
					detail: { summary: "Replace Software system requirement", tags: ["Software"] },
				},
			)
			.delete(
				"/:softwareId/system-requirements/:requirementId",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(
						authorization.unit,
						params.softwareId,
						"/systemRequirements",
					);
					await database.transaction(async (tx) => {
						const deleted = await tx
							.delete(softwareRequirement)
							.where(
								and(
									eq(softwareRequirement.id, params.requirementId),
									eq(softwareRequirement.softwareId, params.softwareId),
								),
							)
							.returning({ id: softwareRequirement.id });
						if (!deleted.length) throw new SystemRequirementNotFound();
						await recordUnitRevision(tx, {
							unitId: params.softwareId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:delete",
					params: SoftwareRequirementParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"SystemRequirementNotFound",
						]),
					},
					detail: {
						summary: "Delete Software system requirement",
						tags: ["Software"],
						responses: NoContentResponse,
					},
				},
			),
	);
