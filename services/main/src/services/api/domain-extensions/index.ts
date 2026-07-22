import { StatusCodes } from "http-status-codes";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import {
	NavigationDocument,
	DockDocument,
	UnresolvedBlockReferenceError,
	UnitReferencedBlockDocument,
	ZoneBoundaryDocument,
	ZonePageBlockHostPolicy,
	ZoneThemeDocument,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	assertNavigationDocument,
	assertResolvedBlockReferences,
	assertResolvedNavigationReferences,
	collectBlockReferences,
	collectNavigationReferences,
	parseDocument,
	PortableTextDocument,
	type Block,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { createUnitBlockReferenceResolver } from "../../blocks/reference-resolver";
import { database } from "../../database";
import {
	software,
	softwareRequirement,
	series,
	seriesRelease,
	unitAccessBinding,
	unit,
	unitLink,
	unitLocalization,
	zone,
	zonePage,
	unitDock,
	imageAsset,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import type { DatabaseTransaction } from "../../database";
import { recordUnitRevision } from "../../units/history";
import {
	createNavigationStructure,
	deleteNavigationStructure,
	listNavigationStructures,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../../content-structure/navigation";
import { getContentStructureRevision } from "../../content-structure/service";
import { ContentStructureNotFound } from "../../content-structure/errors";
import { insertUnit } from "../../units/create";
import {
	firstUnitLocalizationCoverAssetId,
	isPrimaryUnitLocalization,
	makePrimaryUnitLocalization,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	unitLocalizationImageAssetIds,
} from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { presentImageAsset } from "../../units/service";
import { getPublicCanonicalUnitSlugAddress } from "../../units/slug-address";
import { replaceZoneSlugAddress } from "../../units/slug-address";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	ReplacePublicUnitSlugAddressBody,
	SlugAddressMutationResponse,
} from "../slug-addresses/schema";
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
	ZoneNavigationReplaceBody,
	ZoneNavigationRevisionBody,
	ZoneDetailQuery,
	ZonePageBody,
	ZonePageListResponse,
	ZonePageParams,
	ZonePageResponse,
	ZoneParams,
	ZoneResponse,
	ZoneRenderQuery,
	ZoneRenderResponse,
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
		slugAddress: await getPublicCanonicalUnitSlugAddress(record.id),
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
	} satisfies typeof ZoneResponse.static;
}

function toZonePageResponse(record: typeof zonePage.$inferSelect) {
	return {
		...record,
		document: parseDocument(UnitReferencedBlockDocument, record.document),
	} satisfies typeof ZonePageResponse.static;
}

function toZoneNavigationResponse(
	record: Awaited<ReturnType<typeof presentNavigationStructure>>,
	latestRevisionId: string,
) {
	return {
		id: record.id,
		zoneId: record.ownerUnitId,
		document: record.document,
		latestRevisionId,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	} satisfies typeof ZoneNavigationResponse.static;
}

function rethrowZoneNavigationNotFound(cause: unknown): never {
	if (cause instanceof ContentStructureNotFound) throw new ZoneNavigationNotFound();
	throw cause;
}

async function getReadableRenderLocalizationRows(ids: readonly string[], profileId?: string) {
	if (!ids.length) return [];
	return database
		.select({
			id: unit.id,
			kind: unit.kind,
			language: unitLocalization.language,
			position: unitLocalization.position,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			content: unitLocalization.content,
			avatarAssetId: unitLocalization.avatarAssetId,
			bannerAssetId: unitLocalization.bannerAssetId,
			coverAssetId: unitLocalization.coverAssetId,
		})
		.from(unit)
		.innerJoin(unitLocalization, eq(unitLocalization.unitId, unit.id))
		.where(and(inArray(unit.id, [...ids]), getUnitReadCondition(profileId)))
		.orderBy(unit.id, unitLocalization.position, unitLocalization.language);
}

function presentRenderUnit(
	rows: Awaited<ReturnType<typeof getReadableRenderLocalizationRows>>,
	preferredLanguage?: string | null,
) {
	const selected =
		(preferredLanguage
			? rows.find((localization) => localization.language === preferredLanguage)
			: undefined) ?? rows[0];
	if (!selected) return null;
	return {
		id: selected.id,
		kind: selected.kind,
		language: selected.language,
		title: selected.title,
		summary: selected.summary,
		avatar: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(rows, "avatar", preferredLanguage),
		),
		banner: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(rows, "banner", preferredLanguage),
		),
		cover: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(rows, "cover", preferredLanguage),
		),
	};
}

function ensureZoneBlockDocument(value: unknown): void {
	try {
		assertUnitReferencedBlockDocument(value, ZonePageBlockHostPolicy);
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

type ZoneReferenceInput = {
	readonly zoneId: string;
	readonly profileId: string;
	readonly additionalPageSlugs?: readonly string[];
};

function createZoneReferenceResolver(tx: DatabaseTransaction, input: ZoneReferenceInput) {
	return createUnitBlockReferenceResolver(tx, {
		host: { unitId: input.zoneId, kind: "zone" },
		profileId: input.profileId,
		additionalZonePageSlugs: input.additionalPageSlugs,
	});
}

async function ensureZoneBlockReferences(
	tx: DatabaseTransaction,
	document: unknown,
	input: ZoneReferenceInput,
): Promise<void> {
	try {
		await assertResolvedBlockReferences(
			parseDocument(UnitReferencedBlockDocument, document),
			createZoneReferenceResolver(tx, input),
		);
	} catch (cause) {
		if (cause instanceof UnresolvedBlockReferenceError) throw new ZoneDocumentInvalid();
		throw cause;
	}
}

async function ensureZoneNavigationReferences(
	tx: DatabaseTransaction,
	document: unknown,
	input: ZoneReferenceInput,
): Promise<void> {
	try {
		await assertResolvedNavigationReferences(
			parseDocument(NavigationDocument, document),
			createZoneReferenceResolver(tx, input),
		);
	} catch (cause) {
		if (cause instanceof UnresolvedBlockReferenceError) throw new ZoneDocumentInvalid();
		throw cause;
	}
}

export default new Elysia()
	.model({
		DockDocument,
		NavigationDocument,
		PortableTextDocument,
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
					const identity = await resolveIdentity(request.headers, "unit:read");
					const { authorization } = identity;
					await authorization.unit.ensureCanRead(
						params.seriesId,
						() => new UnitNotFound("Series"),
					);
					const rows = await database
						.select({
							seriesId: seriesRelease.seriesId,
							releaseUnitId: seriesRelease.releaseUnitId,
							position: seriesRelease.position,
							releasedOn: seriesRelease.releasedOn,
							createdAt: seriesRelease.createdAt,
							updatedAt: seriesRelease.updatedAt,
							type: unit.kind,
							title: unitLocalization.title,
							coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
						})
						.from(seriesRelease)
						.innerJoin(unit, eq(unit.id, seriesRelease.releaseUnitId))
						.leftJoin(
							unitLocalization,
							and(
								eq(unitLocalization.unitId, unit.id),
								isPrimaryUnitLocalization(unit.id),
							),
						)
						.where(
							and(
								eq(seriesRelease.seriesId, params.seriesId),
								inArray(unit.kind, ["book", "software", "media"]),
								getUnitReadCondition(identity.profile?.unitId),
							),
						)
						.orderBy(seriesRelease.position, seriesRelease.releaseUnitId);
					return {
						items: rows.flatMap(({ type, title, coverAssetId, ...row }) =>
							type === "book" || type === "software" || type === "media"
								? [
										{
											...row,
											release: {
												id: row.releaseUnitId,
												type,
												title,
												cover: presentImageAsset(coverAssetId),
											},
										},
									]
								: [],
						),
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
			.put(
				"/:zoneId/slug-address",
				async ({ params, authorization, body }) => {
					const result = await replaceZoneSlugAddress(authorization, {
						zoneId: params.zoneId,
						slug: body.slug,
					});
					return { ...result, canonicalPath: [...result.canonicalPath] };
				},
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: ReplacePublicUnitSlugAddressBody,
					response: {
						[StatusCodes.OK]: SlugAddressMutationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidSlug"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"SlugTaken",
							"SlugScopeUnavailable",
							"SlugScopeCycle",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"SlugDepthExceeded",
						]),
					},
					detail: {
						operationId: "replaceZoneSlugAddress",
						summary: "Replace a Zone slug address",
						description:
							"Assigns or renames a Zone's optional public slug in the permanent zones namespace. The former address is retained as a redirect.",
						tags: ["Zones", "Slug Addresses"],
					},
				},
			)
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
			.get(
				"/:zoneId/render",
				async ({ params, query, request }) => {
					const identity = await resolveIdentity(request.headers, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					const zoneRecord = await getZone(params.zoneId);
					const [pageRecord] = await database
						.select()
						.from(zonePage)
						.where(
							query.page
								? and(
										eq(zonePage.zoneId, params.zoneId),
										eq(zonePage.slug, query.page),
									)
								: and(eq(zonePage.zoneId, params.zoneId), eq(zonePage.home, true)),
						)
						.limit(1);
					if (query.page && !pageRecord) throw new ZonePageNotFound();
					const [dockRecord] = await database
						.select()
						.from(unitDock)
						.where(
							and(
								eq(unitDock.unitId, params.zoneId),
								eq(unitDock.kind, "main"),
								isNull(unitDock.deletedAt),
							),
						)
						.limit(1);
					const navigations = await database.transaction(async (tx) => {
						const records = await listNavigationStructures(
							tx,
							params.zoneId,
							"zone.navigation",
						);
						const items = [];
						for (const record of records) {
							const revisionId = await getContentStructureRevision(
								tx,
								params.zoneId,
								record.id,
							);
							if (!revisionId) throw new ZoneNavigationNotFound();
							items.push(toZoneNavigationResponse(record, revisionId));
						}
						return items;
					});
					const page = pageRecord ? toZonePageResponse(pageRecord) : null;
					const dock = dockRecord
						? {
								unitId: dockRecord.unitId,
								surface: "main" as const,
								document: parseDocument(DockDocument, dockRecord.document),
							}
						: null;
					const unitIds = new Set<string>(page ? [page.titleUnitId] : []);
					const wikiPostIds = new Set<string>();
					const assetIds = new Set<string>();
					const mergeBlockReferences = (document: {
						readonly blocks: readonly Block[];
					}) => {
						const references = collectBlockReferences(document);
						for (const id of references.unitIds) unitIds.add(id);
						for (const id of references.wikiPostIds) wikiPostIds.add(id);
						for (const id of references.assetIds) assetIds.add(id);
					};
					if (page) mergeBlockReferences(page.document);
					if (dock) mergeBlockReferences(dock.document);
					for (const navigation of navigations) {
						const references = collectNavigationReferences(navigation.document);
						for (const id of references.unitIds) unitIds.add(id);
					}

					const wikiRows = await getReadableRenderLocalizationRows(
						[...wikiPostIds],
						identity.authorization.profileId,
					);
					const wikiPosts = [...wikiPostIds].flatMap((id) => {
						const rows = wikiRows.filter((row) => row.id === id);
						const presented = presentRenderUnit(rows, query.language);
						const selected =
							(query.language
								? rows.find((row) => row.language === query.language)
								: undefined) ?? rows[0];
						if (!presented || !selected?.content) return [];
						assertWikiPostPortableTextDocument(selected.content);
						mergeBlockReferences({ blocks: [selected.content] });
						return [{ ...presented, body: selected.content }];
					});
					for (const id of wikiPostIds) unitIds.delete(id);
					const referenceRows = await getReadableRenderLocalizationRows(
						[...unitIds],
						identity.authorization.profileId,
					);
					const units = [...unitIds].flatMap((id) => {
						const presented = presentRenderUnit(
							referenceRows.filter((row) => row.id === id),
							query.language,
						);
						return presented ? [presented] : [];
					});
					const assets = assetIds.size
						? (
								await database
									.select({ id: imageAsset.id })
									.from(imageAsset)
									.where(
										and(
											inArray(imageAsset.id, [...assetIds]),
											eq(imageAsset.status, "ready"),
											eq(imageAsset.access, "public"),
											isNull(imageAsset.deletedAt),
										),
									)
							).flatMap(({ id }) => {
								const presented = presentImageAsset(id);
								return presented ? [presented] : [];
							})
						: [];

					return {
						zone: await toZoneResponse(zoneRecord, query.language),
						page,
						dock,
						navigations,
						references: { units, wikiPosts, assets },
					} satisfies typeof ZoneRenderResponse.static;
				},
				{
					params: ZoneParams,
					query: ZoneRenderQuery,
					response: {
						[StatusCodes.OK]: ZoneRenderResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
					},
					detail: {
						operationId: "getZoneRenderProjection",
						summary: "Get a Zone render projection",
						tags: ["Zones"],
					},
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
					if (body.startsAt !== undefined || body.endsAt !== undefined)
						scopes.push(["zone", "settings"]);
					for (const scope of scopes)
						await ensureUnitMutationAuthorized(
							authorization.unit,
							params.zoneId,
							scope,
						);
					const current = await getZone(params.zoneId);
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
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneTimeRangeInvalid"]),
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
					access: "write:unit:delete",
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
							.select({ id: zone.id })
							.from(zone)
							.where(eq(zone.id, params.zoneId))
							.limit(1);
						if (!zoneRecord) throw new UnitNotFound("Zone");
						const pages = await tx
							.select({ id: zonePage.id, document: zonePage.document })
							.from(zonePage)
							.where(eq(zonePage.zoneId, params.zoneId));
						const navigations = await listNavigationStructures(
							tx,
							params.zoneId,
							"zone.navigation",
						);
						const docks = await tx
							.select({ document: unitDock.document })
							.from(unitDock)
							.where(
								and(eq(unitDock.unitId, params.zoneId), isNull(unitDock.deletedAt)),
							);
						const referencedByBlock =
							docks.some((dock) =>
								collectBlockReferences(
									parseDocument(DockDocument, dock.document),
								).zonePageSlugs.has(params.slug),
							) ||
							pages
								.filter((page) => page.id !== target.id)
								.some((page) =>
									collectBlockReferences(
										parseDocument(UnitReferencedBlockDocument, page.document),
									).zonePageSlugs.has(params.slug),
								);
						const referencedByNavigation = navigations.some((navigation) =>
							collectNavigationReferences(navigation.document).zonePageSlugs.has(
								params.slug,
							),
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
					access: "contribute:unit:update",
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
					return database.transaction(async (tx) => {
						const records = await listNavigationStructures(
							tx,
							params.zoneId,
							"zone.navigation",
						);
						const items = [];
						for (const record of records) {
							const revisionId = await getContentStructureRevision(
								tx,
								params.zoneId,
								record.id,
							);
							if (!revisionId) throw new ZoneNavigationNotFound();
							items.push(toZoneNavigationResponse(record, revisionId));
						}
						return { items };
					});
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
			.post(
				"/:zoneId/navigation",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"navigation",
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
						const result = await createNavigationStructure(tx, {
							ownerUnitId: params.zoneId,
							kind: "zone.navigation",
							document: body.document,
							actorProfileId: profile.unitId,
						});
						const record = await presentNavigationStructure(tx, {
							ownerUnitId: params.zoneId,
							structureId: result.structure.id,
							kind: "zone.navigation",
						});
						return toZoneNavigationResponse(record, result.revisionId);
					});
				},
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: ZoneNavigationBody,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneDocumentInvalid"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Create Zone navigation", tags: ["Zones"] },
				},
			)
			.get(
				"/:zoneId/navigation/:navigationId",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request.headers, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					return database.transaction(async (tx) => {
						try {
							const record = await presentNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
							});
							const revisionId = await getContentStructureRevision(
								tx,
								params.zoneId,
								params.navigationId,
							);
							if (!revisionId) throw new ZoneNavigationNotFound();
							return toZoneNavigationResponse(record, revisionId);
						} catch (cause) {
							if (!(cause instanceof ContentStructureNotFound)) throw cause;
							throw new ZoneNavigationNotFound();
						}
					});
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
				"/:zoneId/navigation/:navigationId",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"navigation",
						params.navigationId,
					]);
					await getZone(params.zoneId);
					ensureZoneNavigationDocument(body.document);
					try {
						return await database.transaction(async (tx) => {
							await tx.execute(
								sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
							);
							await ensureZoneNavigationReferences(tx, body.document, {
								zoneId: params.zoneId,
								profileId: profile.unitId,
							});
							const result = await replaceNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
								document: body.document,
								actorProfileId: profile.unitId,
								baseRevisionId: body.baseRevisionId,
							});
							const record = await presentNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
							});
							return toZoneNavigationResponse(
								record,
								result.revisionCreated ? result.revisionId : body.baseRevisionId,
							);
						});
					} catch (cause) {
						rethrowZoneNavigationNotFound(cause);
					}
				},
				{
					access: "contribute:unit:update",
					params: ZoneNavigationParams,
					body: ZoneNavigationReplaceBody,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneDocumentInvalid"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZoneNavigationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"ContentStructureRevisionConflict",
						]),
					},
					detail: { summary: "Replace Zone navigation", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/navigation/:navigationId",
				async ({ params, body, profile, authorization }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"navigation",
						params.navigationId,
					]);
					try {
						await database.transaction(async (tx) => {
							await tx.execute(
								sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
							);
							const [zoneRecord] = await tx
								.select({ id: zone.id })
								.from(zone)
								.where(eq(zone.id, params.zoneId))
								.limit(1);
							if (!zoneRecord) throw new UnitNotFound("Zone");
							const pages = await tx
								.select({ document: zonePage.document })
								.from(zonePage)
								.where(eq(zonePage.zoneId, params.zoneId));
							const docks = await tx
								.select({ document: unitDock.document })
								.from(unitDock)
								.where(
									and(
										eq(unitDock.unitId, params.zoneId),
										isNull(unitDock.deletedAt),
									),
								);
							if (
								docks.some((dock) =>
									collectBlockReferences(
										parseDocument(DockDocument, dock.document),
									).navigationIds.has(params.navigationId),
								) ||
								pages.some((page) =>
									collectBlockReferences(
										parseDocument(UnitReferencedBlockDocument, page.document),
									).navigationIds.has(params.navigationId),
								)
							)
								throw new ZoneNavigationInUse();
							await deleteNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
								actorProfileId: profile.unitId,
								baseRevisionId: body.baseRevisionId,
							});
						});
					} catch (cause) {
						rethrowZoneNavigationNotFound(cause);
					}
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "contribute:unit:update",
					params: ZoneNavigationParams,
					body: ZoneNavigationRevisionBody,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZoneNavigationNotFound",
						]),
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"ZoneNavigationInUse",
							"ContentStructureRevisionConflict",
						]),
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
					const [releaseUnit] = await database
						.select({ id: unit.id })
						.from(unit)
						.where(
							and(
								eq(unit.id, params.releaseId),
								inArray(unit.kind, ["book", "software", "media"]),
								isNull(unit.deletedAt),
							),
						)
						.limit(1);
					if (!releaseUnit) throw new UnitNotFound("Release Unit");
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
		app.post(
			"",
			async ({ profile, body }) => {
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
					[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
				},
				detail: { summary: "Create Zone", tags: ["Zones"] },
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
