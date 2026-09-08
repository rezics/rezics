import { readNativeZoneRenderReferences } from "./render-native-references";
import { catalogUnitLocator } from "../../database/schema/catalog-identity";
import { unitStateRelation } from "../../units/state-relation";
import { AuthenticationRequired } from "../../auth/errors";
import { presentImageAsset } from "../image-assets/presentation";
import { selfAuthUserIdForEntity } from "../../participation/account-query";
import {
	CustomThemeExternalLiveAccessCapability,
	DevelopmentPreviewCapability,
} from "@rezics/access";
import {
	assertNavigationDocument,
	assertResolvedBlockReferences,
	assertResolvedNavigationReferences,
	assertUnitReferencedBlockDocument,
	collectBlockReferences,
	collectNavigationReferences,
	DockDocument,
	NavigationDocument,
	parseDocument,
	UnitReferencedBlockDocument,
	UnresolvedBlockReferenceError,
	walkBlockTree,
	ZoneAppearanceDocument,
	ZonePageBlockHostPolicy,
	type Block,
	type ZoneAppearanceDocument as ZoneAppearanceDocumentValue,
} from "@rezics/block";
import {
	assertFilterDocument,
	collectUnitPredicateReferenceIds,
	FilterDocument,
	filterDocumentControlField,
	parseFilterDocument,
} from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";
import { ZoneHomePageSlug } from "@rezics/slug";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";

import session, { resolveIdentity } from "../../auth/session";
import type { Authorization } from "../../authorization";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { createUnitBlockReferenceResolver } from "../../blocks/reference-resolver";
import { ContentStructureInvalid, ContentStructureNotFound } from "../../content-structure/errors";
import {
	createNavigationStructure,
	deleteNavigationStructure,
	listNavigationStructures,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../../content-structure/navigation";
import { getContentStructureRevision } from "../../content-structure/service";
import { resolveUnitPresentation } from "../../custom-themes";
import type { DatabaseTransaction } from "../../database";
import { database } from "../../database";
import {
	imageAsset,
	post,
	realm,
	realmRule,
	realmRuleRevision,
	unitDock,
	unitLocalization,
	unitOwnership,
	zone,
} from "../../database/schema";
import { presentWikiPostPortableTextDocument } from "../../documents/portable-text-presentation";
import { currentRealmRuleRevisionReadLock } from "../../realms/rule-revision-lock";
import { assertExecutableBlockFilterDocuments } from "../../search/block-filter-documents";
import { resolveFilterDocument } from "../../search/filter-document";
import { presentAvatar } from "../../units/avatar";
import { insertPlatformUnit } from "../../units/create";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	avatarReferenceFromColumns,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";

import {
	getPublicCanonicalUnitSlugAddress,
	replaceZoneSlugAddress,
} from "../../units/slug-address";
import { provisionZoneDefaultExperienceInTransaction } from "../../zones/default-experience";
import {
	deleteZonePagePlacement,
	getZonePageAddressById,
	getZonePageStructureProjection,
	getZonePageUnitById,
	getZonePageUnitBySlug,
	listZonePageCanonicalSlugs,
	listZonePageUnits,
	resolveZonePageAddressBySlug,
	upsertZonePagePlacement,
	upsertZonePageUnit,
	type ZonePageProjection,
} from "../../zones/pages";
import {
	ensureImageAssetsAttachable,
	ensurePublicZoneThemeHeroAsset,
	findPublicZoneThemeHeroAsset,
} from "../image-assets/service";
import { IdResponse, NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	ReplacePublicUnitSlugAddressBody,
	SlugAddressMutationResponse,
} from "../slug-addresses/schema";
import {
	ZoneDocumentInvalid,
	ZoneNavigationInUse,
	ZoneNavigationNotFound,
	ZonePageInUse,
	ZonePageNotFound,
	ZoneRuleRealmInvalid,
	ZoneTimeRangeInvalid,
} from "./errors";
import {
	CreateZoneBody,
	UpdateZoneBody,
	ZoneDetailQuery,
	ZoneNavigationBody,
	ZoneNavigationListResponse,
	ZoneNavigationParams,
	ZoneNavigationReplaceBody,
	ZoneNavigationResponse,
	ZoneNavigationRevisionBody,
	ZonePageAddressResponse,
	ZonePageBody,
	ZonePageIdParams,
	ZonePageListResponse,
	ZonePagePlacementBody,
	ZonePagePlacementDeleteBody,
	ZonePageResponse,
	ZonePageSlugParams,
	ZoneParams,
	ZoneRenderQuery,
	ZoneRenderResponse,
	ZoneRenderUnitResponse,
	ZoneResponse,
} from "./schema";

const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);
const ZonePreviewMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"PlatformCapabilityRequired",
]);
const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

const UnitMutationNotFoundResponse = toApiErrorResponse(["UnitNotFound", "ImageAssetNotFound"]);

function requireAuthUserId(authorization: Authorization<string>): string {
	if (!authorization.authUserId) throw new AuthenticationRequired();
	return authorization.authUserId;
}

async function ensureUnitMutationAuthorized(
	authorization: UnitAuthorization<string>,
	unitId: string,
	scope: readonly string[],
): Promise<void> {
	await authorization.ensureCanUpdate(unitId, [scope]);
}

async function getZone(zoneId: string) {
	const [record] = await database.select().from(zone).where(eq(zone.id, zoneId)).limit(1);
	if (!record) throw new UnitNotFound("Zone");
	return record;
}

async function ensureZoneRuleRealm(tx: DatabaseTransaction, realmId: string): Promise<void> {
	await tx.execute(currentRealmRuleRevisionReadLock(realmId));
	const [revision] = await tx
		.select({ id: realmRuleRevision.id })
		.from(realmRuleRevision)
		.innerJoin(realm, and(eq(realm.id, realmRuleRevision.realmId), isNull(realm.deletedAt)))
		.where(eq(realmRuleRevision.realmId, realmId))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1)
		.for("share");
	if (!revision) throw new ZoneRuleRealmInvalid();
	const [rule] = await tx
		.select({ id: realmRule.id })
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!rule) throw new ZoneRuleRealmInvalid();
}

async function toZoneResponse(
	record: Awaited<ReturnType<typeof getZone>>,
	localizationLanguages: readonly ContentLanguage[] = [],
	capabilities: {
		readonly canManage: boolean;
		readonly canManageTheme: boolean;
		readonly hasDevelopmentPreviewAccess: boolean;
	} = {
		canManage: false,
		canManageTheme: false,
		hasDevelopmentPreviewAccess: false,
	},
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
	const appearanceDocument = parseDocument(ZoneAppearanceDocument, record.appearanceDocument);
	const themeHero = await database.transaction((tx) =>
		findPublicZoneThemeHeroAsset(tx, appearanceDocument.heroAssetId),
	);
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
			resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "cover", localizationLanguages),
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
		filterDocument: parseFilterDocument(record.filterDocument),
		appearanceDocument,
		themeHero,
		capabilities,
	} satisfies StaticDecode<typeof ZoneResponse>;
}

const ZoneThemeLevel1Keys = [
	"heroAssetId",
	"cardRadius",
	"headingFontScale",
	"surfaceTint",
] as const satisfies readonly (keyof ZoneAppearanceDocumentValue)[];

function hasZoneThemeLevel1Delta(
	current: ZoneAppearanceDocumentValue,
	next: ZoneAppearanceDocumentValue,
): boolean {
	return ZoneThemeLevel1Keys.some((key) => current[key] !== next[key]);
}

async function getZoneResponseCapabilities<ProfileId extends string | undefined>(
	authorization: Authorization<ProfileId>,
	zoneId: string,
) {
	const [canManage, themeAccess] = await Promise.all([
		authorization.unit.canUpdate(zoneId),
		authorization.zone.getThemeAccess(zoneId),
	]);
	return {
		canManage,
		...themeAccess,
	};
}

function toZonePageResponse(record: ZonePageProjection) {
	return {
		...record,
		localizations: record.localizations.map((localization) => ({ ...localization })),
	} satisfies StaticDecode<typeof ZonePageResponse>;
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
	} satisfies StaticDecode<typeof ZoneNavigationResponse>;
}

function rethrowZoneNavigationNotFound(cause: unknown): never {
	if (cause instanceof ContentStructureNotFound) throw new ZoneNavigationNotFound();
	throw cause;
}

async function getReadableRenderLocalizationRows(
	ids: readonly string[],
	authorization: UnitAuthorization<string | undefined>,
) {
	if (!ids.length) return [];
	if (ids.length > 500) throw new RangeError("Zone render reference limit exceeded");
	const state = unitStateRelation(unitLocalization.unitId, "render_unit_state");
	const rows = await database
		.select({
			id: state.id,
			kind: state.owner,
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
		.from(unitLocalization)
		.innerJoinLateral(state, sql`true`)
		.where(inArray(unitLocalization.unitId, [...ids]))
		.orderBy(unitLocalization.unitId, unitLocalization.position, unitLocalization.language);
	const readableIds = await authorization.readableUnitIds(ids);
	return rows.filter((row) => readableIds.has(row.id));
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
		avatar: presentAvatar(resolveUnitLocalizationAvatarFromOrdered(rows, localizationLanguages)),
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
		assertExecutableBlockFilterDocuments(value, true);
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

function ensureZoneFilterDocument(
	value: unknown,
): asserts value is StaticDecode<typeof FilterDocument> {
	try {
		assertFilterDocument(value);
		resolveFilterDocument(value, true);
	} catch {
		throw new ZoneDocumentInvalid();
	}
}

async function ensureZoneFilterReferences(
	tx: DatabaseTransaction,
	document: StaticDecode<typeof FilterDocument>,
): Promise<void> {
	const labelIds = new Set(
		(document.controls ?? []).flatMap((control) =>
			control.labelUnitId ? [control.labelUnitId] : [],
		),
	);
	const tagIds = new Set<string>();
	for (const control of document.controls ?? [])
		if (
			filterDocumentControlField(control) === "tag" &&
			control.optionPolicy &&
			control.optionPolicy.kind !== "all"
		)
			for (const value of control.optionPolicy.values)
				if (typeof value === "string") tagIds.add(value);
	const predicateIds = document.where ? collectUnitPredicateReferenceIds(document.where) : [];
	const ids = [...new Set([...labelIds, ...tagIds, ...predicateIds])];
	if (!ids.length) return;
	if (ids.length > 500) throw new ZoneDocumentInvalid();
	const state = unitStateRelation(catalogUnitLocator.id, "zone_filter_state");
	const records = await tx
		.select({
			id: state.id,
			kind: state.owner,
			status: state.status,
			visibility: state.visibility,
			moderationStatus: state.moderationStatus,
		})
		.from(catalogUnitLocator)
		.innerJoinLateral(state, sql`true`)
		.where(inArray(catalogUnitLocator.id, ids));
	const recordById = new Map(records.map((record) => [record.id, record]));
	const isPublicKind = (id: string, kind: "label" | "tag") => {
		const record = recordById.get(id);
		return (
			record?.kind === kind &&
			record.status === "published" &&
			record.visibility === "public" &&
			record.moderationStatus === "approved"
		);
	};
	const isPublicUnit = (id: string) => {
		const record = recordById.get(id);
		return (
			record?.status === "published" &&
			record.visibility === "public" &&
			record.moderationStatus === "approved"
		);
	};
	if ([...labelIds].some((id) => !isPublicKind(id, "label"))) throw new ZoneDocumentInvalid();
	if ([...tagIds].some((id) => !isPublicKind(id, "tag"))) throw new ZoneDocumentInvalid();
	if (predicateIds.some((id) => !isPublicUnit(id))) throw new ZoneDocumentInvalid();
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

export default new Elysia()
	.use(session)
	.group("/zones", (app) =>
		app
			.put(
				"/:zoneId/slug-address",
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
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["SlugDepthExceeded"]),
					},
					detail: {
						operationId: "replaceZoneSlugAddress",
						summary: "Replace a Zone slug address",
						description:
							"Development preview. Assigns or renames a Zone's optional public slug in the permanent zones namespace. The former address is retained as a redirect.",
						tags: ["Zones", "Slug Addresses"],
					},
				},
				async ({ params, authorization, body }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					const result = await replaceZoneSlugAddress(authorization, {
						zoneId: params.zoneId,
						slug: body.slug,
					});
					return { ...result, canonicalPath: [...result.canonicalPath] };
				},
			)
			.get(
				"/:zoneId",
				{
					params: ZoneParams,
					query: ZoneDetailQuery,
					response: {
						[StatusCodes.OK]: ZoneResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "Get Zone configuration", tags: ["Zones"] },
				},
				async ({ params, query, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					return toZoneResponse(
						await getZone(params.zoneId),
						query.localizationLanguages,
						await getZoneResponseCapabilities(authorization, params.zoneId),
					);
				},
			)
			.get(
				"/:zoneId/render",
				{
					params: ZoneParams,
					query: ZoneRenderQuery,
					response: {
						[StatusCodes.OK]: ZoneRenderResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
					},
					detail: {
						operationId: "getZoneRenderProjection",
						summary: "Get a Zone render projection",
						tags: ["Zones"],
					},
				},
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
							? getZonePageUnitById(tx, params.zoneId, query.pageId, query.localizationLanguages)
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
						const records = await listNavigationStructures(tx, params.zoneId, "zone.navigation");
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
					let usesZoneFilter = false;
					const mergeBlockReferences = (document: { readonly blocks: readonly Block[] }) => {
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
								usesZoneFilter = true;
						});
					};
					const viewerEligible = identity.entity
						? (
								await Promise.all([
									identity.authorization.platform.hasCapability(DevelopmentPreviewCapability),
									identity.authorization.platform.hasCapability(
										CustomThemeExternalLiveAccessCapability,
									),
								])
							).every(Boolean)
						: false;
					const resolvedPresentation = await resolveUnitPresentation({
						hostUnitId: params.zoneId,
						viewerProfileId: identity.entity?.id,
						viewerEligible,
						safeMode: query.safeMode ?? false,
					});
					mergeBlockReferences(resolvedPresentation.document.header);
					mergeBlockReferences(resolvedPresentation.document.footer);
					if (page) mergeBlockReferences(page.document);
					if (dock) mergeBlockReferences(dock.document);
					for (const navigation of navigations) {
						const references = collectNavigationReferences(navigation.document);
						for (const id of references.unitIds) unitIds.add(id);
					}
					if (usesZoneFilter) {
						const filterDocument = parseFilterDocument(zoneRecord.filterDocument);
						for (const id of [
							...(filterDocument.controls ?? []).map((control) => control.labelUnitId),
							...(filterDocument.controls ?? []).flatMap((control) =>
								(control.field === "tag" || control.key === "tag") &&
								control.optionPolicy &&
								control.optionPolicy.kind !== "all"
									? control.optionPolicy.values.filter(
											(value): value is string => typeof value === "string",
										)
									: [],
							),
						])
							if (id) unitIds.add(id);
					}

					const wikiRows = await getReadableRenderLocalizationRows(
						[...wikiPostIds],
						identity.authorization.unit,
					);
					const wikiPosts = [...wikiPostIds].flatMap((id) => {
						const rows = wikiRows.filter((row) => row.id === id);
						const presented = presentRenderUnit(rows, query.localizationLanguages);
						const selected = resolveUnitLocalizationFromOrdered(
							rows,
							query.localizationLanguages ?? [],
						);
						if (!presented || !selected?.content) return [];
						const content = presentWikiPostPortableTextDocument(
							selected.content,
							"unit_localization.content",
						);
						mergeBlockReferences({ blocks: [content] });
						return [{ ...presented, body: content }];
					});
					for (const id of wikiPostIds) unitIds.delete(id);
					const referenceRows = await getReadableRenderLocalizationRows(
						[...unitIds],
						identity.authorization.unit,
					);
					const zonePageSlugs = await database.transaction((tx) =>
						listZonePageCanonicalSlugs(tx, params.zoneId, [...unitIds]),
					);
					const nativeReferences = await readNativeZoneRenderReferences(
						[...unitIds],
						identity.authorization.unit,
					);
					const nativeById = new Map(nativeReferences.map((item) => [item.id, item]));
					const units = [...unitIds].flatMap<StaticDecode<typeof ZoneRenderUnitResponse>>((id) => {
						const native = nativeById.get(id);
						if (native) return [native];
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
							await getZoneResponseCapabilities(identity.authorization, params.zoneId),
						),
						page,
						dock,
						navigations,
						resolvedPresentation,
						references: { units, wikiPosts, assets },
					} satisfies StaticDecode<typeof ZoneRenderResponse>;
				},
			)
			.patch(
				"/:zoneId",
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: UpdateZoneBody,
					response: {
						[StatusCodes.OK]: ZoneResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"ZoneDocumentInvalid",
							"ZoneRuleRealmInvalid",
							"ZoneTimeRangeInvalid",
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
					},
					detail: { summary: "Update Zone configuration", tags: ["Zones"] },
				},
				async ({ params, entity, authorization, body }) => {
					if (body.filterDocument) ensureZoneFilterDocument(body.filterDocument);
					const scopes: string[][] = [];
					if (body.localization) scopes.push(["localizations", body.localization.language]);
					if (body.filterDocument) scopes.push(["zone", "filter"]);
					if (body.startsAt !== undefined || body.endsAt !== undefined)
						scopes.push(["zone", "settings"]);
					if (body.localRuleRealmId !== undefined) scopes.push(["zone", "settings"]);
					for (const scope of scopes)
						await ensureUnitMutationAuthorized(authorization.unit, params.zoneId, scope);
					if (body.localRuleRealmId) await authorization.unit.ensureCanRead(body.localRuleRealmId);
					await authorization.unit.ensureCanRead(params.zoneId);
					const current = await getZone(params.zoneId);
					if (body.appearanceDocument) {
						const currentTheme = parseDocument(ZoneAppearanceDocument, current.appearanceDocument);
						await authorization.zone.ensureThemeMutation(
							params.zoneId,
							hasZoneThemeLevel1Delta(currentTheme, body.appearanceDocument)
								? "development_preview"
								: "released",
						);
					}
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
						if (body.filterDocument) await ensureZoneFilterReferences(tx, body.filterDocument);
						if (body.localRuleRealmId) await ensureZoneRuleRealm(tx, body.localRuleRealmId);
						if (body.appearanceDocument)
							await ensurePublicZoneThemeHeroAsset(tx, body.appearanceDocument.heroAssetId);
						if (body.localization) {
							const storedLocalization = toUnitLocalizationStorage(body.localization);
							await ensureImageAssetsAttachable(
								tx,
								selfAuthUserIdForEntity(entity.id),
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
							body.filterDocument ||
							body.appearanceDocument ||
							body.startsAt !== undefined ||
							body.endsAt !== undefined ||
							body.localRuleRealmId !== undefined
						)
							await tx
								.update(zone)
								.set({
									...(body.filterDocument ? { filterDocument: body.filterDocument } : {}),
									...(body.appearanceDocument
										? { appearanceDocument: body.appearanceDocument }
										: {}),
									...(body.startsAt !== undefined ? { startsAt } : {}),
									...(body.endsAt !== undefined ? { endsAt } : {}),
									...(body.localRuleRealmId !== undefined
										? { localRuleRealmId: body.localRuleRealmId }
										: {}),
								})
								.where(eq(zone.id, params.zoneId));
						await recordUnitRevision(tx, {
							unitId: params.zoneId,
							actorProfileId: entity.id,
							contribution: body.revisionContext?.contribution,
							event: "update",
						});
					});
					return toZoneResponse(
						await getZone(params.zoneId),
						body.localization ? [body.localization.language] : [],
						await getZoneResponseCapabilities(authorization, params.zoneId),
					);
				},
			)
			.get(
				"/:zoneId/page-addresses/by-id/:pageId",
				{
					params: ZonePageIdParams,
					response: {
						[StatusCodes.OK]: ZonePageAddressResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
					},
					detail: {
						operationId: "getZonePageAddressById",
						summary: "Get one bounded Zone Page address projection by Unit ID",
						tags: ["Zones"],
					},
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					await getZone(params.zoneId);
					const address = await database.transaction((tx) =>
						getZonePageAddressById(tx, params.zoneId, params.pageId),
					);
					if (!address) throw new ZonePageNotFound();
					return address;
				},
			)
			.get(
				"/:zoneId/page-addresses/by-slug/:slug",
				{
					params: ZonePageSlugParams,
					response: {
						[StatusCodes.OK]: ZonePageAddressResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
					},
					detail: {
						operationId: "resolveZonePageAddressBySlug",
						summary: "Resolve one bounded Zone Page address by scoped slug",
						tags: ["Zones"],
					},
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					await getZone(params.zoneId);
					const address = await database.transaction((tx) =>
						resolveZonePageAddressBySlug(tx, params.zoneId, params.slug),
					);
					if (!address) throw new ZonePageNotFound();
					return address;
				},
			)
			.get(
				"/:zoneId/pages",
				{
					params: ZoneParams,
					response: {
						[StatusCodes.OK]: ZonePageListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Zone pages", tags: ["Zones"] },
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					await getZone(params.zoneId);
					return database.transaction(async (tx) => ({
						items: await listZonePageUnits(tx, params.zoneId),
						pageStructure: await getZonePageStructureProjection(tx, params.zoneId),
					}));
				},
			)
			.post(
				"/:zoneId/pages",
				{
					access: "contribute:unit:update",
					params: ZoneParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"InvalidSlug",
							"ZoneDocumentInvalid",
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse(["SlugTaken", "UnitRevisionConflict"]),
					},
					detail: {
						summary: "Create Zone page in development preview",
						tags: ["Zones"],
					},
				},
				async ({ params, entity, authorization, body }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await authorization.zone.ensurePagesMutation(params.zoneId);
					await getZone(params.zoneId);
					ensureZoneBlockDocument(body.localization.document);
					try {
						return await upsertZonePageUnit({
							actorAuthUserId: requireAuthUserId(authorization),
							zoneId: params.zoneId,
							slug: body.slug,
							actorProfileId: entity.id,
							contribution: body.revisionContext?.contribution,
							localization: body.localization,
							ensureReferences: (tx, document) =>
								ensureZoneBlockReferences(tx, document, {
									zoneId: params.zoneId,
									profileId: entity.id,
								}),
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid) throw new ZoneDocumentInvalid();
						throw cause;
					}
				},
			)
			.get(
				"/:zoneId/pages/:pageId",
				{
					params: ZonePageIdParams,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
					},
					detail: { summary: "Get Zone page by Unit ID", tags: ["Zones"] },
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					const page = await database.transaction((tx) =>
						getZonePageUnitById(tx, params.zoneId, params.pageId),
					);
					if (!page) throw new ZonePageNotFound();
					return toZonePageResponse(page);
				},
			)
			.put(
				"/:zoneId/pages/:pageId",
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePageBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"InvalidSlug",
							"ZoneDocumentInvalid",
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: ZonePreviewMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse(["SlugTaken", "UnitRevisionConflict"]),
					},
					detail: {
						summary: "Replace Zone page in development preview",
						tags: ["Zones"],
					},
				},
				async ({ params, entity, authorization, body }) => {
					await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
					await authorization.zone.ensurePagesMutation(params.zoneId);
					ensureZoneBlockDocument(body.localization.document);
					try {
						return await upsertZonePageUnit({
							actorAuthUserId: requireAuthUserId(authorization),
							zoneId: params.zoneId,
							pageId: params.pageId,
							slug: body.slug,
							actorProfileId: entity.id,
							contribution: body.revisionContext?.contribution,
							localization: body.localization,
							baseUnitRevisionId: body.baseUnitRevisionId,
							ensureReferences: (tx, document) =>
								ensureZoneBlockReferences(tx, document, {
									zoneId: params.zoneId,
									profileId: entity.id,
								}),
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid) throw new ZoneDocumentInvalid();
						throw cause;
					}
				},
			)
			.put(
				"/:zoneId/pages/:pageId/placement",
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePagePlacementBody,
					response: {
						[StatusCodes.OK]: ZonePageResponse,
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
						[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
						[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ContentStructureInvalid"]),
					},
					detail: { summary: "Index Zone page in page-structure", tags: ["Zones"] },
				},
				async ({ params, entity, authorization, body }) => {
					await authorization.zone.ensurePagesMutation(params.zoneId);
					return upsertZonePagePlacement({
						zoneId: params.zoneId,
						pageId: params.pageId,
						actorProfileId: entity.id,
						parentPageId: body.parentPageId,
						position: body.position,
						baseStructureRevisionId: body.baseStructureRevisionId,
					});
				},
			)
			.delete(
				"/:zoneId/pages/:pageId/placement",
				{
					access: "contribute:unit:update",
					params: ZonePageIdParams,
					body: ZonePagePlacementDeleteBody,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
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
				async ({ params, body, entity, authorization }) => {
					await authorization.zone.ensurePagesMutation(params.zoneId);
					try {
						await deleteZonePagePlacement({
							zoneId: params.zoneId,
							pageId: params.pageId,
							actorProfileId: entity.id,
							baseStructureRevisionId: body.baseStructureRevisionId,
						});
					} catch (cause) {
						if (cause instanceof ContentStructureInvalid) throw new ZonePageInUse();
						throw cause;
					}
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			)
			.get(
				"/:zoneId/navigation",
				{
					params: ZoneParams,
					response: {
						[StatusCodes.OK]: ZoneNavigationListResponse,
						[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
					},
					detail: { summary: "List Zone navigation resources", tags: ["Zones"] },
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
					await getZone(params.zoneId);
					return database.transaction(async (tx) => {
						const records = await listNavigationStructures(tx, params.zoneId, "zone.navigation");
						return {
							items: records.map((record) =>
								toZoneNavigationResponse(record, record.latestRevisionId),
							),
						};
					});
				},
			)
			.post(
				"/:zoneId/navigation",
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
				async ({ params, entity, authorization, body }) => {
					await authorization.zone.ensurePagesMutation(params.zoneId);
					await getZone(params.zoneId);
					ensureZoneNavigationDocument(body.document);
					return database.transaction(async (tx) => {
						await tx.execute(
							sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
						);
						await ensureZoneNavigationReferences(tx, body.document, {
							zoneId: params.zoneId,
							profileId: entity.id,
						});
						const result = await createNavigationStructure(tx, {
							ownerUnitId: params.zoneId,
							kind: "zone.navigation",
							document: body.document,
							actorProfileId: entity.id,
						});
						const record = await presentNavigationStructure(tx, {
							ownerUnitId: params.zoneId,
							structureId: result.structure.id,
							kind: "zone.navigation",
						});
						return toZoneNavigationResponse(record, result.revisionId);
					});
				},
			)
			.get(
				"/:zoneId/navigation/:navigationId",
				{
					params: ZoneNavigationParams,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZoneNavigationNotFound"]),
					},
					detail: { summary: "Get Zone navigation resource", tags: ["Zones"] },
				},
				async ({ params, request }) => {
					const authorization = (await resolveIdentity(request, "unit:read")).authorization;
					await authorization.unit.ensureCanRead(params.zoneId, () => new UnitNotFound("Zone"));
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
			)
			.put(
				"/:zoneId/navigation/:navigationId",
				{
					access: "contribute:unit:update",
					params: ZoneNavigationParams,
					body: ZoneNavigationReplaceBody,
					response: {
						[StatusCodes.OK]: ZoneNavigationResponse,
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["ZoneDocumentInvalid"]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZoneNavigationNotFound"]),
						[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
					},
					detail: { summary: "Replace Zone navigation", tags: ["Zones"] },
				},
				async ({ params, entity, authorization, body }) => {
					await authorization.zone.ensurePagesMutation(params.zoneId);
					await getZone(params.zoneId);
					ensureZoneNavigationDocument(body.document);
					try {
						return await database.transaction(async (tx) => {
							await tx.execute(
								sql`select pg_advisory_xact_lock(hashtextextended(${`zone-graph:${params.zoneId}`}::text, 0))`,
							);
							await ensureZoneNavigationReferences(tx, body.document, {
								zoneId: params.zoneId,
								profileId: entity.id,
							});
							const result = await replaceNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
								document: body.document,
								actorProfileId: entity.id,
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
			)
			.delete(
				"/:zoneId/navigation/:navigationId",
				{
					access: "contribute:unit:update",
					params: ZoneNavigationParams,
					body: ZoneNavigationRevisionBody,
					response: {
						[StatusCodes.NO_CONTENT]: t.Void(),
						[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
							"RevisionCreditEntityInvalid",
							"RevisionContributionActorRequired",
						]),
						[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZoneNavigationNotFound"]),
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
				async ({ params, body, entity, authorization }) => {
					await authorization.zone.ensurePagesMutation(params.zoneId);
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
								.where(and(eq(unitDock.unitId, params.zoneId), isNull(unitDock.deletedAt)));
							if (
								docks.some((dock) =>
									collectBlockReferences(
										parseDocument(DockDocument, dock.document),
									).navigationIds.has(params.navigationId),
								) ||
								pages.some((page) =>
									collectBlockReferences(page.document).navigationIds.has(params.navigationId),
								)
							)
								throw new ZoneNavigationInUse();
							await deleteNavigationStructure(tx, {
								ownerUnitId: params.zoneId,
								structureId: params.navigationId,
								kind: "zone.navigation",
								actorProfileId: entity.id,
								baseRevisionId: body.baseRevisionId,
							});
						});
					} catch (cause) {
						rethrowZoneNavigationNotFound(cause);
					}
					return new Response(null, { status: StatusCodes.NO_CONTENT });
				},
			),
	)
	.group("/zones", (app) =>
		app.post(
			"",
			{
				access: "contribute:unit:create",
				body: CreateZoneBody,
				response: {
					[StatusCodes.OK]: IdResponse,
					[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
						"ZoneDocumentInvalid",
						"ZoneRuleRealmInvalid",
						"ZoneTimeRangeInvalid",
						"RevisionCreditEntityInvalid",
						"RevisionContributionActorRequired",
					]),
					[StatusCodes.FORBIDDEN]: toApiErrorResponse([
						"PlatformCapabilityRequired",
						"UnitPermissionForbidden",
					]),
					[StatusCodes.NOT_FOUND]: UnitMutationNotFoundResponse,
				},
				detail: { summary: "Create Zone", tags: ["Zones"] },
			},
			async ({ entity, authorization, body }) => {
				await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
				if (body.localRuleRealmId) await authorization.unit.ensureCanRead(body.localRuleRealmId);
				ensureZoneFilterDocument(body.filterDocument);
				const startsAt = body.startsAt ? new Date(body.startsAt) : null;
				const endsAt = body.endsAt ? new Date(body.endsAt) : null;
				if (startsAt && endsAt && endsAt <= startsAt) throw new ZoneTimeRangeInvalid();
				const id = await database.transaction(async (tx) => {
					if (body.localRuleRealmId) await ensureZoneRuleRealm(tx, body.localRuleRealmId);
					await ensurePublicZoneThemeHeroAsset(tx, body.appearanceDocument.heroAssetId);
					await ensureImageAssetsAttachable(
						tx,
						requireAuthUserId(authorization),
						unitLocalizationImageAssetReferences(body.localization),
					);
					await ensureZoneFilterReferences(tx, body.filterDocument);
					const created = await insertPlatformUnit(tx, {
						owner: "zone",
						values: {
							createdByAuthUserId: requireAuthUserId(authorization),
							status: "published",
							visibility: "public",
							publishedAt: new Date(),
							filterDocument: body.filterDocument,
							appearanceDocument: body.appearanceDocument,
							startsAt,
							endsAt,
							localRuleRealmId: body.localRuleRealmId ?? null,
						},
						statusActor: { kind: "profile", profileId: entity.id },
					});
					const unitId = created.id;
					await tx
						.insert(unitLocalization)
						.values({ unitId, ...toUnitLocalizationStorage(body.localization) });
					await tx
						.insert(unitOwnership)
						.values({ unitId, profileId: entity.id, assignedByProfileId: entity.id });
					await recordUnitRevision(tx, {
						unitId,
						actorProfileId: entity.id,
						contribution: body.revisionContext?.contribution,
						event: "create",
					});
					await provisionZoneDefaultExperienceInTransaction(tx, {
						actorAuthUserId: requireAuthUserId(authorization),
						zoneId: unitId,
						actorProfileId: entity.id,
						language: body.localization.language,
						title: body.localization.title,
					});
					return unitId;
				});
				return { id };
			},
		),
	);
