import { DevelopmentPreviewCapability } from "@rezics/access";
import { StatusCodes } from "http-status-codes";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { AvatarReference } from "@rezics/avatar";
import {
	JsonValue as JsonValueSchema,
	type JsonValue as JsonValueType,
} from "@rezics/portable-text";
import { Check } from "@sinclair/typebox/value";
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
	walkBlockTree,
	type Block,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { assertUnitPredicate, FilterSchemaModels } from "@rezics/filter";
import { ZoneHomePageSlug } from "@rezics/slug";

import session, { resolveIdentity } from "../../auth/session";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { createUnitBlockReferenceResolver } from "../../blocks/reference-resolver";
import { database } from "../../database";
import {
	software,
	softwareRequirement,
	post,
	series,
	seriesRelease,
	unitOwnership,
	unit,
	unitSourceLink,
	unitLocalization,
	zone,
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
import { ContentStructureInvalid, ContentStructureNotFound } from "../../content-structure/errors";
import { insertUnit } from "../../units/create";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { presentAvatar } from "../../units/avatar";
import { presentImageAsset } from "../../units/service";
import { getPublicCanonicalUnitSlugAddress } from "../../units/slug-address";
import { replaceZoneSlugAddress } from "../../units/slug-address";
import {
	deleteZonePagePlacement,
	getZonePageStructureProjection,
	getZonePageUnitById,
	getZonePageUnitBySlug,
	listZonePageUnits,
	upsertZonePagePlacement,
	upsertZonePageUnit,
	type ZonePageProjection,
} from "../../zones/pages";
import { getZoneSearchFeature } from "../../zones/search-feature";
import { provisionZoneDefaultExperienceInTransaction } from "../../zones/default-experience";
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
	SeriesReleaseListQuery,
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
	ZonePageIdParams,
	ZonePageListResponse,
	ZonePagePlacementBody,
	ZonePagePlacementDeleteBody,
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

const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);
const ZonePreviewMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"PlatformCapabilityRequired",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function presentSystemRequirement<Requirement extends { hardware: Record<string, unknown> }>(
	requirement: Requirement,
): Omit<Requirement, "hardware"> & {
	hardware: Record<string, JsonValueType>;
} {
	if (!Object.values(requirement.hardware).every((value) => Check(JsonValueSchema, value)))
		throw new Error("Stored Software system requirement hardware is not valid JSON");
	return {
		...requirement,
		hardware: requirement.hardware as Record<string, JsonValueType>,
	};
}
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
			avatar?: AvatarReference | null;
			bannerAssetId?: string | null;
			coverAssetId?: string | null;
		};
		ownerId: string;
	},
) {
	await ensureImageAssetsAttachable(
		tx,
		input.ownerId,
		unitLocalizationImageAssetReferences(input.localization),
	);
	const created = await insertUnit(tx, {
		kind: input.kind,
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.ownerId },
	});
	await tx
		.insert(unitLocalization)
		.values({ unitId: created.id, ...toUnitLocalizationStorage(input.localization) });
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: input.ownerId,
		assignedByProfileId: input.ownerId,
	});
	return created.id;
}

async function ensureRequirementSource(softwareId: string, sourceExternalLinkId?: string | null) {
	if (!sourceExternalLinkId) return;
	const [source] = await database
		.select({ id: unitSourceLink.id })
		.from(unitSourceLink)
		.where(
			and(eq(unitSourceLink.id, sourceExternalLinkId), eq(unitSourceLink.unitId, softwareId)),
		)
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
	localizationLanguages: readonly ContentLanguage[] = [],
	canManage = false,
) {
	const localizations = await database
		.select({
			language: unitLocalization.language,
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
		.where(eq(unitLocalization.unitId, record.id))
		.orderBy(unitLocalization.position, unitLocalization.language);
	const selected = resolveUnitLocalizationFromOrdered(localizations, localizationLanguages);
	if (!selected) throw new UnitNotFound("Zone");
	return {
		...record,
		slugAddress: await getPublicCanonicalUnitSlugAddress(record.id),
		language: selected.language,
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
		boundaryDocument: parseDocument(ZoneBoundaryDocument, record.boundaryDocument),
		themeDocument: parseDocument(ZoneThemeDocument, record.themeDocument),
		capabilities: { canManage },
	} satisfies typeof ZoneResponse.static;
}

function toZonePageResponse(record: ZonePageProjection) {
	return {
		...record,
		localizations: record.localizations.map((localization) => ({ ...localization })),
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
			avatarType: unitLocalization.avatarType,
			avatarAssetId: unitLocalization.avatarAssetId,
			avatarEmoji: unitLocalization.avatarEmoji,
			avatarIconPrefix: unitLocalization.avatarIconPrefix,
			avatarIconName: unitLocalization.avatarIconName,
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
	localizationLanguages: readonly ContentLanguage[] = [],
	zonePageSlugs: ReadonlyMap<string, string | null> = new Map(),
) {
	const resolved = resolveUnitLocalizationFromOrdered(rows, localizationLanguages);
	if (!resolved) return null;
	const selected = resolved;
	return {
		id: selected.id,
		kind: selected.kind,
		zonePageSlug: zonePageSlugs.get(selected.id) ?? null,
		language: selected.language,
		title: selected.title,
		summary: selected.summary,
		avatar: presentAvatar(
			resolveUnitLocalizationAvatarFromOrdered(rows, localizationLanguages),
		),
		banner: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(rows, "banner", localizationLanguages),
			"banner",
		),
		cover: presentImageAsset(
			resolveUnitLocalizationImageAssetIdFromOrdered(rows, "cover", localizationLanguages),
			"cover",
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
};

function createZoneReferenceResolver(tx: DatabaseTransaction, input: ZoneReferenceInput) {
	return createUnitBlockReferenceResolver(tx, {
		host: { unitId: input.zoneId, kind: "zone" },
		profileId: input.profileId,
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

const ZoneBoundaryDocumentModel = t.Object(
	{
		...ZoneBoundaryDocument.properties,
		filter: t.Optional(t.Ref("UnitPredicate")),
	},
	{ additionalProperties: false, $id: "ZoneBoundaryDocument" },
);

export default new Elysia()
	.model({
		DockDocument,
		...FilterSchemaModels,
		NavigationDocument,
		PortableTextDocument,
		UnitReferencedBlockDocument,
		ZoneBoundaryDocument: ZoneBoundaryDocumentModel,
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
				async ({ params, query, request }) => {
					const localizationLanguages = query.localizationLanguages ?? [];
					const identity = await resolveIdentity(request, "unit:read");
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
							language: unitLocalization.language,
							title: unitLocalization.title,
							coverAssetId: resolvedUnitLocalizationImageAssetId(
								unit.id,
								"cover",
								localizationLanguages,
							),
						})
						.from(seriesRelease)
						.innerJoin(unit, eq(unit.id, seriesRelease.releaseUnitId))
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
								eq(seriesRelease.seriesId, params.seriesId),
								inArray(unit.kind, ["book", "software", "media"]),
								getUnitReadCondition(identity.profile?.unitId),
							),
						)
						.orderBy(seriesRelease.position, seriesRelease.releaseUnitId);
					return {
						items: rows.flatMap(({ type, language, title, coverAssetId, ...row }) =>
							type === "book" || type === "software" || type === "media"
								? [
										{
											...row,
											release: {
												id: row.releaseUnitId,
												type,
												language,
												title,
												cover: presentImageAsset(coverAssetId, "cover"),
											},
										},
									]
								: [],
						),
					};
				},
				{
					params: SeriesParams,
					query: SeriesReleaseListQuery,
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
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
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
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
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
							"Development preview. Assigns or renames a Zone's optional public slug in the permanent zones namespace. The former address is retained as a redirect.",
						tags: ["Zones", "Slug Addresses"],
					},
				},
			)
			.get(
				"/:zoneId",
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					return toZoneResponse(
						await getZone(params.zoneId),
						query.localizationLanguages,
						await authorization.unit.canUpdate(params.zoneId),
					);
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
					const identity = await resolveIdentity(request, "unit:read");
					await identity.authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					const zoneRecord = await getZone(params.zoneId);
					if (query.page && query.pageId) throw new ZonePageNotFound();
					const pageRecord = await database.transaction((tx) =>
						query.pageId
							? getZonePageUnitById(
									tx,
									params.zoneId,
									query.pageId,
									query.localizationLanguages,
								)
							: getZonePageUnitBySlug(
									tx,
									params.zoneId,
									query.page ?? ZoneHomePageSlug,
									query.localizationLanguages,
								),
					);
					if ((query.page || query.pageId) && !pageRecord) throw new ZonePageNotFound();
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
						return records.map((record) =>
							toZoneNavigationResponse(record, record.latestRevisionId),
						);
					});
					const page = pageRecord ? toZonePageResponse(pageRecord) : null;
					const dock = dockRecord
						? {
								unitId: dockRecord.unitId,
								surface: "main" as const,
								document: parseDocument(DockDocument, dockRecord.document),
							}
						: null;
					const unitIds = new Set<string>();
					const wikiPostIds = new Set<string>();
					const assetIds = new Set<string>();
					if (query.postId) {
						const [zoneWikiPost] = await database
							.select({ id: post.id })
							.from(post)
							.where(
								and(
									eq(post.id, query.postId),
									eq(post.kind, "wiki"),
									eq(post.subjectUnitId, params.zoneId),
								),
							)
							.limit(1);
						if (zoneWikiPost) wikiPostIds.add(zoneWikiPost.id);
					}
					let usesZoneSearchFeature = false;
					const mergeBlockReferences = (document: {
						readonly blocks: readonly Block[];
					}) => {
						const references = collectBlockReferences(document);
						for (const id of references.unitIds) unitIds.add(id);
						for (const id of references.wikiPostIds) wikiPostIds.add(id);
						for (const id of references.assetIds) assetIds.add(id);
						walkBlockTree(document, (block) => {
							if (
								(block._type === "feed" && block.feature.kind === "zone") ||
								(block._type === "unit-list" &&
									block.source.kind === "search" &&
									block.source.feature.kind === "zone")
							)
								usesZoneSearchFeature = true;
						});
					};
					if (page) mergeBlockReferences(page.document);
					if (dock) mergeBlockReferences(dock.document);
					for (const navigation of navigations) {
						const references = collectNavigationReferences(navigation.document);
						for (const id of references.unitIds) unitIds.add(id);
					}
					if (usesZoneSearchFeature) {
						const feature = await database.transaction((tx) =>
							getZoneSearchFeature(tx, params.zoneId),
						);
						if (feature)
							for (const id of [
								...feature.document.controls.map((control) => control.labelUnitId),
								...feature.document.sections.map((section) => section.labelUnitId),
								...feature.document.controls.flatMap((control) =>
									control.field === "tag" && control.optionPolicy?.kind !== "all"
										? (control.optionPolicy?.values ?? []).filter(
												(value): value is string =>
													typeof value === "string",
											)
										: [],
								),
							])
								if (id) unitIds.add(id);
					}

					const wikiRows = await getReadableRenderLocalizationRows(
						[...wikiPostIds],
						identity.authorization.profileId,
					);
					const wikiPosts = [...wikiPostIds].flatMap((id) => {
						const rows = wikiRows.filter((row) => row.id === id);
						const presented = presentRenderUnit(rows, query.localizationLanguages);
						const selected = resolveUnitLocalizationFromOrdered(
							rows,
							query.localizationLanguages ?? [],
						);
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
					const zonePageSlugs = new Map(
						(
							await database.transaction((tx) => listZonePageUnits(tx, params.zoneId))
						).map((candidate) => [candidate.id, candidate.slug] as const),
					);
					const units = [...unitIds].flatMap((id) => {
						const presented = presentRenderUnit(
							referenceRows.filter((row) => row.id === id),
							query.localizationLanguages,
							zonePageSlugs,
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
						zone: await toZoneResponse(
							zoneRecord,
							query.localizationLanguages,
							await identity.authorization.unit.canUpdate(params.zoneId),
						),
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
					if (body.boundaryDocument?.filter)
						try {
							assertUnitPredicate(body.boundaryDocument.filter);
						} catch {
							throw new ZoneDocumentInvalid();
						}
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
							const storedLocalization = toUnitLocalizationStorage(body.localization);
							await ensureImageAssetsAttachable(
								tx,
								profile.unitId,
								unitLocalizationImageAssetReferences(body.localization),
							);
							await tx
								.insert(unitLocalization)
								.values({ unitId: params.zoneId, ...storedLocalization })
								.onConflictDoUpdate({
									target: [unitLocalization.unitId, unitLocalization.language],
									set: storedLocalization,
								});
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
						body.localization ? [body.localization.language] : [],
						true,
					);
				},
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: UpdateZoneBody,
					response: {
						[StatusCodes.OK]: ZoneResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"ZoneDocumentInvalid",
							"ZoneTimeRangeInvalid",
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
					const authorization = (await resolveIdentity(request, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					await getZone(params.zoneId);
					return database.transaction(async (tx) => ({
						items: await listZonePageUnits(tx, params.zoneId),
						pageStructure: await getZonePageStructureProjection(tx, params.zoneId),
					}));
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
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page",
					]);
					await getZone(params.zoneId);
					ensureZoneBlockDocument(body.localization.document);
					try {
						return await upsertZonePageUnit({
							zoneId: params.zoneId,
							slug: body.slug,
							actorProfileId: profile.unitId,
							localization: body.localization,
							ensureReferences: (tx, document) =>
								ensureZoneBlockReferences(tx, document, {
									zoneId: params.zoneId,
									profileId: profile.unitId,
								}),
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid)
							throw new ZoneDocumentInvalid();
						throw cause;
					}
				},
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"InvalidSlug",
							"ZoneDocumentInvalid",
						]),
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"SlugTaken",
							"UnitRevisionConflict",
						]),
					},
					detail: {
						summary: "Create Zone page in development preview",
						tags: ["Zones"],
					},
				},
			)
			.get(
				"/:zoneId/pages/:pageId",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.zoneId,
						() => new UnitNotFound("Zone"),
					);
					const page = await database.transaction((tx) =>
						getZonePageUnitById(tx, params.zoneId, params.pageId),
					);
					if (!page) throw new ZonePageNotFound();
					return toZonePageResponse(page);
				},
				{
					params: ZonePageIdParams,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse([
							"UnitNotFound",
							"ZonePageNotFound",
						]),
					},
					detail: { summary: "Get Zone page by Unit ID", tags: ["Zones"] },
				},
			)
			.put(
				"/:zoneId/pages/:pageId",
				async ({ params, profile, authorization, body }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page",
						params.pageId,
					]);
					ensureZoneBlockDocument(body.localization.document);
					try {
						return await upsertZonePageUnit({
							zoneId: params.zoneId,
							pageId: params.pageId,
							slug: body.slug,
							actorProfileId: profile.unitId,
							localization: body.localization,
							baseUnitRevisionId: body.baseUnitRevisionId,
							ensureReferences: (tx, document) =>
								ensureZoneBlockReferences(tx, document, {
									zoneId: params.zoneId,
									profileId: profile.unitId,
								}),
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid)
							throw new ZoneDocumentInvalid();
						throw cause;
					}
				},
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"InvalidSlug",
							"ZoneDocumentInvalid",
						]),
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"SlugTaken",
							"UnitRevisionConflict",
						]),
					},
					detail: {
						summary: "Replace Zone page in development preview",
						tags: ["Zones"],
					},
				},
			)
			.put(
				"/:zoneId/pages/:pageId/placement",
				async ({ params, profile, authorization, body }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page-structure",
					]);
					return upsertZonePagePlacement({
						zoneId: params.zoneId,
						pageId: params.pageId,
						actorProfileId: profile.unitId,
						parentPageId: body.parentPageId,
						position: body.position,
						baseStructureRevisionId: body.baseStructureRevisionId,
					});
				},
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePagePlacementBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"ContentStructureRevisionConflict",
						]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse([
							"ContentStructureInvalid",
						]),
					},
					detail: { summary: "Index Zone page in page-structure", tags: ["Zones"] },
				},
			)
			.delete(
				"/:zoneId/pages/:pageId/placement",
				async ({ params, body, profile, authorization }) => {
					await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, [
						"zone",
						"page-structure",
					]);
					try {
						await deleteZonePagePlacement({
							zoneId: params.zoneId,
							pageId: params.pageId,
							actorProfileId: profile.unitId,
							baseStructureRevisionId: body.baseStructureRevisionId,
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid) throw new ZonePageInUse();
						throw cause;
					}
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePagePlacementDeleteBody,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse([
							"ZonePageInUse",
							"ContentStructureRevisionConflict",
						]),
					},
					detail: {
						summary: "Remove Zone page from page-structure",
						tags: ["Zones"],
						responses: NoContentResponse,
					},
				},
			)
			.get(
				"/:zoneId/navigation",
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read"))
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
						return {
							items: records.map((record) =>
								toZoneNavigationResponse(record, record.latestRevisionId),
							),
						};
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
					const authorization = (await resolveIdentity(request, "unit:read"))
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
							const pages = await listZonePageUnits(tx, params.zoneId);
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
									collectBlockReferences(page.document).navigationIds.has(
										params.navigationId,
									),
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
					access: "contribute:unit:update",
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
			async ({ profile, authorization, body }) => {
				await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
				if (body.boundaryDocument.filter)
					try {
						assertUnitPredicate(body.boundaryDocument.filter);
					} catch {
						throw new ZoneDocumentInvalid();
					}
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
					await provisionZoneDefaultExperienceInTransaction(tx, {
						zoneId: unitId,
						actorProfileId: profile.unitId,
						language: body.localization.language,
						title: body.localization.title,
						searchTemplate: "global",
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
						"ZoneDocumentInvalid",
						"ZoneTimeRangeInvalid",
					]),
					[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
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
					const authorization = (await resolveIdentity(request, "unit:read"))
						.authorization;
					await authorization.unit.ensureCanRead(
						params.softwareId,
						() => new UnitNotFound("Software"),
					);
					const items = await database
						.select()
						.from(softwareRequirement)
						.where(eq(softwareRequirement.softwareId, params.softwareId))
						.orderBy(
							softwareRequirement.platformEntityId,
							softwareRequirement.tier,
							softwareRequirement.id,
						);
					return {
						items: items.map(presentSystemRequirement),
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
					return presentSystemRequirement(created);
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
						return presentSystemRequirement(updated);
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
					access: "contribute:unit:update",
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
