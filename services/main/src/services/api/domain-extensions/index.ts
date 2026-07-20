import { StatusCodes } from "http-status-codes";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import {
	NavigationDocument,
	UnitReferencedBlockDocument,
	ZoneBoundaryDocument,
	ZoneDockBlockHostPolicy,
	ZonePageBlockHostPolicy,
	ZoneThemeDocument,
	assertUnitReferencedBlockDocument,
	assertNavigationDocument,
	assertResolvedBlockReferences,
	assertResolvedNavigationReferences,
	collectBlockReferences,
	collectNavigationReferences,
	parseDocument,
	type BlockReferenceResolver,
	type PortableTextDocument,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import {
	software,
	softwareRequirement,
	imageAsset,
	series,
	seriesRelease,
	unit,
	unitAccessBinding,
	unitLink,
	unitLocalization,
	zone,
	zoneNavigation,
	zonePage,
	unitFollow,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import { insertUnit } from "../../units/create";
import {
	makePrimaryUnitLocalization,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	unitLocalizationImageAssetIds,
} from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { presentImageAsset } from "../../units/service";
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
	UpdateZoneBody,
	UpsertSeriesReleaseBody,
	ZoneNavigationBody,
	ZoneNavigationListResponse,
	ZoneNavigationParams,
	ZoneNavigationResponse,
	ZoneDetailQuery,
	ZonePageBody,
	ZonePageListResponse,
	ZonePageParams,
	ZonePageResponse,
	ZoneParams,
	ZoneResponse,
} from "./schema";
import {
	SoftwareNotFound,
	SoftwareSystemRequirementSourceInvalid,
	SeriesReleaseNotFound,
	SystemRequirementNotFound,
	ZoneDocumentInvalid,
	ZoneNavigationInUse,
	ZoneNavigationNotFound,
	ZonePageNotFound,
	ZonePageInUse,
	ZoneTimeRangeInvalid,
} from "./errors";

const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const UnitMutationNotFoundResponse = toApiErrorResponse(["UnitNotFound", "ImageAssetNotFound"]);

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await authorization.ensureCanUpdate(unitId, [scope]);
}

async function createBaseUnit(
	tx: DatabaseTransaction,
	input: {
		kind: "series" | "zone";
		localization: {
			language: ContentLanguage;
			title: string;
			summary?: string;
			description?: PortableTextDocument;
			avatarAssetId?: string | null;
			bannerAssetId?: string | null;
			coverAssetId?: string | null;
		};
		ownerId: string;
	},
) {
	await ensureImageAssetsAttachable(
		tx,
		input.ownerId,
		unitLocalizationImageAssetIds(input.localization),
	);
	const created = await insertUnit(tx, {
		kind: input.kind,
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.ownerId },
	});
	await tx.insert(unitLocalization).values({ unitId: created.id, ...input.localization });
	await tx.insert(unitAccessBinding).values({
		unitId: created.id,
		subjectKind: "profile",
		profileId: input.ownerId,
		role: "owner",
		scope: [],
		grantedByProfileId: input.ownerId,
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

async function getZone(zoneId: string) {
	const [record] = await database.select().from(zone).where(eq(zone.id, zoneId)).limit(1);
	if (!record) throw new UnitNotFound("Zone");
	return record;
}

async function toZoneResponse(
	record: Awaited<ReturnType<typeof getZone>>,
	preferredLanguage?: string | null,
) {
	const localizations = await database
		.select({
			language: unitLocalization.language,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			avatarAssetId: unitLocalization.avatarAssetId,
			bannerAssetId: unitLocalization.bannerAssetId,
			coverAssetId: unitLocalization.coverAssetId,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, record.id))
		.orderBy(unitLocalization.position, unitLocalization.language);
	const avatarAssetId = resolveUnitLocalizationImageAssetIdFromOrdered(
		localizations,
		"avatar",
		preferredLanguage,
	);
	const bannerAssetId = resolveUnitLocalizationImageAssetIdFromOrdered(
		localizations,
		"banner",
		preferredLanguage,
	);
	const coverAssetId = resolveUnitLocalizationImageAssetIdFromOrdered(
		localizations,
		"cover",
		preferredLanguage,
	);
	return {
		...record,
		language: localizations[0]?.language ?? null,
		avatar: presentImageAsset(avatarAssetId),
		banner: presentImageAsset(bannerAssetId),
		cover: presentImageAsset(coverAssetId),
		localizations: localizations.map(
			({ avatarAssetId, bannerAssetId, coverAssetId, ...localization }) => ({
				...localization,
				avatar: presentImageAsset(avatarAssetId),
				banner: presentImageAsset(bannerAssetId),
				cover: presentImageAsset(coverAssetId),
			}),
		),
		boundaryDocument: parseDocument(ZoneBoundaryDocument, record.boundaryDocument),
		themeDocument: parseDocument(ZoneThemeDocument, record.themeDocument),
		dockDocument: parseDocument(UnitReferencedBlockDocument, record.dockDocument),
	} satisfies typeof ZoneResponse.static;
}

function toZonePageResponse(record: typeof zonePage.$inferSelect) {
	return {
		...record,
		document: parseDocument(UnitReferencedBlockDocument, record.document),
	} satisfies typeof ZonePageResponse.static;
}

function toZoneNavigationResponse(record: typeof zoneNavigation.$inferSelect) {
	return {
		...record,
		document: parseDocument(NavigationDocument, record.document),
	} satisfies typeof ZoneNavigationResponse.static;
}

function ensureZoneBlockDocument(value: unknown, dock = false): void {
	try {
		assertUnitReferencedBlockDocument(
			value,
			dock ? ZoneDockBlockHostPolicy : ZonePageBlockHostPolicy,
		);
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

function ensureZoneNavigationDocument(value: unknown): void {
	try {
		assertNavigationDocument(value, { allowExternalNavigation: true });
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

function createZoneReferenceResolver(
	tx: DatabaseTransaction,
	input: {
		readonly zoneId: string;
		readonly profileId: string;
		readonly additionalPageSlugs?: readonly string[];
	},
): BlockReferenceResolver {
	return {
		async resolve(kind, identifiers) {
			if (!identifiers.length) return new Set<string>();
			if (kind === "unit") {
				const rows = await tx
					.select({ id: unit.id })
					.from(unit)
					.where(
						and(
							inArray(unit.id, [...identifiers]),
							getUnitReadCondition(input.profileId),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			if (kind === "asset") {
				const rows = await tx
					.select({ id: imageAsset.id })
					.from(imageAsset)
					.where(
						and(
							inArray(imageAsset.id, [...identifiers]),
							eq(imageAsset.status, "ready"),
							isNull(imageAsset.deletedAt),
							or(
								eq(imageAsset.access, "public"),
								eq(imageAsset.ownerProfileId, input.profileId),
							),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			if (kind === "navigation") {
				const rows = await tx
					.select({ id: zoneNavigation.id })
					.from(zoneNavigation)
					.where(
						and(
							eq(zoneNavigation.zoneId, input.zoneId),
							inArray(zoneNavigation.id, [...identifiers]),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			const rows = await tx
				.select({ slug: zonePage.slug })
				.from(zonePage)
				.where(
					and(
						eq(zonePage.zoneId, input.zoneId),
						inArray(zonePage.slug, [...identifiers]),
					),
				);
			return new Set([...rows.map((row) => row.slug), ...(input.additionalPageSlugs ?? [])]);
		},
	};
}

async function ensureZoneBlockReferences(
	tx: DatabaseTransaction,
	document: unknown,
	input: Parameters<typeof createZoneReferenceResolver>[1],
): Promise<void> {
	try {
		await assertResolvedBlockReferences(
			parseDocument(UnitReferencedBlockDocument, document),
			createZoneReferenceResolver(tx, input),
		);
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

async function ensureZoneNavigationReferences(
	tx: DatabaseTransaction,
	document: unknown,
	input: Parameters<typeof createZoneReferenceResolver>[1],
): Promise<void> {
	try {
		await assertResolvedNavigationReferences(
			parseDocument(NavigationDocument, document),
			createZoneReferenceResolver(tx, input),
		);
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

export default new Elysia()
	.model({
		NavigationDocument,
		UnitReferencedBlockDocument,
		ZoneBoundaryDocument,
		ZoneThemeDocument,
	})
	.use(session)
	.group("/series", (app) =>
		app
			.post(
				"",
				async ({ profile, body }) => {
					const id = await database.transaction(async (tx) => {
						const unitId = await createBaseUnit(tx, {
							kind: "series",
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
					response: {
						[StatusCodes.OK]: IdResponse,
						[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
					},
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
			),
	)
	.group("/zones", (app) =>
		app
			.get(
				"/:zoneId",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					return toZoneResponse(await getZone(params.zoneId), query.language);
				},
				{
					params: ZoneParams,
					query: ZoneDetailQuery,
					response: {
						[StatusCodes.OK]: ZoneResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Get Zone configuration", tags: ["Zones"] },
				},
			)
			.patch(
				"/:zoneId",
				async ({ params, profile, authorization, body }) => {
					const scopes: string[][] = [];
					if (body.localization)
						scopes.push(["localizations", body.localization.language]);
					if (body.boundaryDocument) scopes.push(["zone", "boundary"]);
					if (body.themeDocument) scopes.push(["zone", "theme"]);
					if (body.dockDocument) scopes.push(["zone", "dock"]);
					if (body.startsAt !== undefined || body.endsAt !== undefined)
						scopes.push(["zone", "settings"]);
					for (const scope of scopes)
						await ensureUnitMutationAuthorized(
							authorization.unit,
							params.zoneId,
							scope,
						);
					const current = await getZone(params.zoneId);
					if (body.dockDocument) ensureZoneBlockDocument(body.dockDocument, true);
					const startsAt =
						body.startsAt === undefined
							? current.startsAt
							: body.startsAt === null
								? null
								: new Date(body.startsAt);
					const endsAt =
						body.endsAt === undefined
							? current.endsAt
							: body.endsAt === null
								? null
								: new Date(body.endsAt);
					if (startsAt && endsAt && endsAt <= startsAt) throw new ZoneTimeRangeInvalid();
					await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						if (body.dockDocument)
							await ensureZoneBlockReferences(tx, body.dockDocument, {
								zoneId: params.zoneId,
								profileId: profile.unitId,
							});
						if (body.localization) {
							await ensureImageAssetsAttachable(
								tx,
								profile.unitId,
								unitLocalizationImageAssetIds(body.localization),
							);
							await tx
								.insert(unitLocalization)
								.values({ unitId: params.zoneId, ...body.localization })
								.onConflictDoUpdate({
									target: [unitLocalization.unitId, unitLocalization.language],
									set: { ...body.localization },
								});
							await makePrimaryUnitLocalization(
								tx,
								params.zoneId,
								body.localization.language,
							);
						}
						if (
							body.boundaryDocument ||
							body.themeDocument ||
							body.dockDocument ||
							body.startsAt !== undefined ||
							body.endsAt !== undefined
						)
							await tx
								.update(zone)
								.set({
									...(body.boundaryDocument
										? { boundaryDocument: body.boundaryDocument }
										: {}),
									...(body.themeDocument
										? { themeDocument: body.themeDocument }
										: {}),
									...(body.dockDocument
										? { dockDocument: body.dockDocument }
										: {}),
									...(body.startsAt !== undefined ? { startsAt } : {}),
									...(body.endsAt !== undefined ? { endsAt } : {}),
								})
								.where(eq(zone.id, params.zoneId));
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return toZoneResponse(
						await getZone(params.zoneId),
						body.localization?.language,
					);
				},
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: UpdateZoneBody,
					response: {
						[StatusCodes.OK]: ZoneResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"ZoneTimeRangeInvalid",
							"ZoneDocumentInvalid",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
					},
					detail: { summary: "Update Zone configuration", tags: ["Zones"] },
				},
			)
			.get(
				"/:zoneId/pages",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					return {
						items: (
							await database
								.select()
								.from(zonePage)
								.where(eq(zonePage.zoneId, params.zoneId))
								.orderBy(zonePage.position, zonePage.id)
						).map(toZonePageResponse),
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
			.get(
				"/:zoneId/pages/:slug",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					const [page] = await database
						.select()
						.from(zonePage)
						.where(
							and(eq(zonePage.zoneId, params.zoneId), eq(zonePage.slug, params.slug)),
						)
						.limit(1);
					if (!page) throw new ZonePageNotFound();
					return toZonePageResponse(page);
				},
				{
					params: ZonePageParams,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
					},
					detail: { summary: "Get Zone page", tags: ["Zones"] },
				},
			)
			.put(
				"/:zoneId/pages/:slug",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page",
						params.slug,
					]);
					await getZone(params.zoneId);
					await authorization.unit.ensureCanRead(
						body.titleUnitId,
						() => new UnitNotFound("Zone page title Unit"),
					);
					ensureZoneBlockDocument(body.document);
					return database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						await ensureZoneBlockReferences(tx, body.document, {
							zoneId: params.zoneId,
							profileId: profile.unitId,
							additionalPageSlugs: [params.slug],
						});
						if (body.home)
							await tx
								.update(zonePage)
								.set({ home: false })
								.where(eq(zonePage.zoneId, params.zoneId));
						const [saved] = await tx
							.insert(zonePage)
							.values({ zoneId: params.zoneId, slug: params.slug, ...body })
							.onConflictDoUpdate({
								target: [zonePage.zoneId, zonePage.slug],
								set: body,
							})
							.returning();
						if (!saved) throw new Error("Zone page upsert returned no row");
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return toZonePageResponse(saved);
					});
				},
				{
					access: "contribute:unit:update",
					params: ZonePageParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneDocumentInvalid"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Create or replace Zone page", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/pages/:slug",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page",
						params.slug,
					]);
					await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						const [target] = await tx
							.select({ id: zonePage.id })
							.from(zonePage)
							.where(
								and(
									eq(zonePage.zoneId, params.zoneId),
									eq(zonePage.slug, params.slug),
								),
							)
							.limit(1);
						if (!target) throw new ZonePageNotFound();
						const [zoneRecord] = await tx
							.select({ dockDocument: zone.dockDocument })
							.from(zone)
							.where(eq(zone.id, params.zoneId))
							.limit(1);
						if (!zoneRecord) throw new UnitNotFound("Zone");
						const pages = await tx
							.select({ id: zonePage.id, document: zonePage.document })
							.from(zonePage)
							.where(eq(zonePage.zoneId, params.zoneId));
						const navigations = await tx
							.select({ document: zoneNavigation.document })
							.from(zoneNavigation)
							.where(eq(zoneNavigation.zoneId, params.zoneId));
						const referencedByBlock = [
							zoneRecord.dockDocument,
							...pages
								.filter((page) => page.id !== target.id)
								.map((page) => page.document),
						].some((document) =>
							collectBlockReferences(
								parseDocument(UnitReferencedBlockDocument, document),
							).zonePageSlugs.has(params.slug),
						);
						const referencedByNavigation = navigations.some((navigation) =>
							collectNavigationReferences(
								parseDocument(NavigationDocument, navigation.document),
							).zonePageSlugs.has(params.slug),
						);
						if (referencedByBlock || referencedByNavigation) throw new ZonePageInUse();
						await tx.delete(zonePage).where(eq(zonePage.id, target.id));
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:delete",
					params: ZonePageParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["ZonePageInUse"]),
					},
					detail: {
						summary: "Delete Zone page",
						tags: ["Zones"],
						responses: NoContentResponse,
					},
				},
			)
			.get(
				"/:zoneId/navigation",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					return {
						items: (
							await database
								.select()
								.from(zoneNavigation)
								.where(eq(zoneNavigation.zoneId, params.zoneId))
								.orderBy(zoneNavigation.position, zoneNavigation.id)
						).map(toZoneNavigationResponse),
					};
				},
				{
					params: ZoneParams,
					response: {
						[StatusCodes.OK]: ZoneNavigationListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Zone navigation resources", tags: ["Zones"] },
				},
			)
			.get(
				"/:zoneId/navigation/:key",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					const [navigation] = await database
						.select()
						.from(zoneNavigation)
						.where(
							and(
								eq(zoneNavigation.zoneId, params.zoneId),
								eq(zoneNavigation.key, params.key),
							),
						)
						.limit(1);
					if (!navigation) throw new ZoneNavigationNotFound();
					return toZoneNavigationResponse(navigation);
				},
				{
					params: ZoneNavigationParams,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZoneNavigationNotFound",
						]),
					},
					detail: { summary: "Get Zone navigation resource", tags: ["Zones"] },
				},
			)
			.put(
				"/:zoneId/navigation/:key",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"navigation",
						params.key,
					]);
					await getZone(params.zoneId);
					ensureZoneNavigationDocument(body.document);
					return database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						await ensureZoneNavigationReferences(tx, body.document, {
							zoneId: params.zoneId,
							profileId: profile.unitId,
						});
						const [saved] = await tx
							.insert(zoneNavigation)
							.values({ zoneId: params.zoneId, key: params.key, ...body })
							.onConflictDoUpdate({
								target: [zoneNavigation.zoneId, zoneNavigation.key],
								set: body,
							})
							.returning();
						if (!saved) throw new Error("Zone navigation upsert returned no row");
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
						return toZoneNavigationResponse(saved);
					});
				},
				{
					access: "contribute:unit:update",
					params: ZoneNavigationParams,
					body: ZoneNavigationBody,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneDocumentInvalid"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Create or replace Zone navigation", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/navigation/:key",
				async ({ params, profile, authorization }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"navigation",
						params.key,
					]);
					await database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						const [target] = await tx
							.select({ id: zoneNavigation.id })
							.from(zoneNavigation)
							.where(
								and(
									eq(zoneNavigation.zoneId, params.zoneId),
									eq(zoneNavigation.key, params.key),
								),
							)
							.limit(1);
						if (!target) throw new ZoneNavigationNotFound();
						const [zoneRecord] = await tx
							.select({ dockDocument: zone.dockDocument })
							.from(zone)
							.where(eq(zone.id, params.zoneId))
							.limit(1);
						if (!zoneRecord) throw new UnitNotFound("Zone");
						const pages = await tx
							.select({ document: zonePage.document })
							.from(zonePage)
							.where(eq(zonePage.zoneId, params.zoneId));
						const documents = [
							zoneRecord.dockDocument,
							...pages.map((page) => page.document),
						];
						if (
							documents.some((document) =>
								collectBlockReferences(
									parseDocument(UnitReferencedBlockDocument, document),
								).navigationIds.has(target.id),
							)
						)
							throw new ZoneNavigationInUse();
						await tx.delete(zoneNavigation).where(eq(zoneNavigation.id, target.id));
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: profile.unitId,
							event: "update",
						});
					});
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "write:unit:delete",
					params: ZoneNavigationParams,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZoneNavigationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["ZoneNavigationInUse"]),
					},
					detail: {
						summary: "Delete Zone navigation resource",
						tags: ["Zones"],
						responses: NoContentResponse,
					},
				},
			),
	)
	.group("/series", (app) =>
		app
			.put(
				"/:seriesId/releases/:releaseId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.seriesId, [
						"releases",
					]);
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
					await ensureUnitMutationAuthorized(authorization.unit, params.seriesId, [
						"releases",
					]);
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
				async ({ profile, body }) => {
					ensureZoneBlockDocument(body.dockDocument, true);
					const startsAt = body.startsAt ? new Date(body.startsAt) : null;
					const endsAt = body.endsAt ? new Date(body.endsAt) : null;
					if (startsAt && endsAt && endsAt <= startsAt) throw new ZoneTimeRangeInvalid();
					const id = await database.transaction(async (tx) => {
						const unitId = await createBaseUnit(tx, {
							kind: "zone",
							localization: body.localization,
							ownerId: profile.unitId,
						});
						await tx.insert(zone).values({
							id: unitId,
							boundaryDocument: body.boundaryDocument,
							themeDocument: body.themeDocument,
							dockDocument: body.dockDocument,
							startsAt,
							endsAt,
						});
						await ensureZoneBlockReferences(tx, body.dockDocument, {
							zoneId: unitId,
							profileId: profile.unitId,
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
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"ZoneTimeRangeInvalid",
							"ZoneDocumentInvalid",
						]),
						[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
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
					await getZone(params.zoneId);
					await database
						.insert(unitFollow)
						.values({ followerProfileId: profile.unitId, unitId: params.zoneId })
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
						.delete(unitFollow)
						.where(
							and(
								eq(unitFollow.followerProfileId, profile.unitId),
								eq(unitFollow.unitId, params.zoneId),
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
					await ensureUnitMutationAuthorized(authorization.unit, params.softwareId, [
						"system-requirements",
					]);
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
					await ensureUnitMutationAuthorized(authorization.unit, params.softwareId, [
						"system-requirements",
					]);
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
					await ensureUnitMutationAuthorized(authorization.unit, params.softwareId, [
						"system-requirements",
					]);
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
