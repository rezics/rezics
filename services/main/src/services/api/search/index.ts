import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";
import {
	BlockKey,
	DockDocument,
	parseDocument,
	type Block,
	type SearchFeatureSource,
} from "@rezics/block";
import {
	SearchFeatureDefinition,
	SearchFeatureInput,
	SearchDocument,
	SharedSearchQueryDocument,
	SearchTemplateId,
} from "@rezics/search";
import {
	createSimpleFeedFilter,
	FilterSchemaModels,
	SimpleFeedContentKindValues,
	type UnitFilter,
} from "@rezics/filter";
import { getActiveObservability } from "@rezics/observability";
import { type Static, Type } from "@sinclair/typebox";
import { and, eq, isNull } from "drizzle-orm";
import { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { AuthenticationRequired } from "../../auth/errors";
import {
	InvalidSearch,
	SearchUnavailable,
	SharedSearchQueryNotFound,
	ZoneSearchFeatureNotFound,
} from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain, searchGrouped } from "../../search/service";
import {
	createDefaultSearchDocument,
	executeSearchFeatureInput,
	resolveSearchDocument,
} from "../../search/templates";
import {
	createSharedSearchQuery,
	getSharedSearchQuery,
	type SharedSearchQueryProjection,
} from "../../search/shared-queries";
import { database } from "../../database";
import { unitDock } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { getZonePageUnitById } from "../../zones/pages";
import {
	getZoneSearchFeature,
	listZoneSearchFeatureRevisions,
	putZoneSearchFeature,
	restoreZoneSearchFeature,
	type ZoneSearchFeatureProjection,
} from "../../search/documents";
import { ZonePageNotFound } from "../domain-extensions/errors";
import { DockNotFound } from "../docks/errors";
import { hydrateFeedItems } from "../feed";
import { FeedContentKindValues } from "../feed/schema";
import { DateTime, Uuid } from "../schema";
import { findFeedBlock, findSearchFeatureSource } from "./block-source";
import { DomainSearchBody, DomainSearchParams, GroupedSearchBody } from "./schema";
import {
	toApiErrorResponse,
	DomainSearchResponse,
	SearchFeedResponse,
	SearchResponse,
} from "../schema/response";

const { logger } = getActiveObservability();

function logSearchFailure(message: string, eventName: string, error: unknown): void {
	logger.error(message, {
		eventName,
		errorCode: "SearchUnavailable",
		error,
	});
}

const SearchUnavailableResponse = toApiErrorResponse(["SearchUnavailable"]);
const InvalidSearchResponse = toApiErrorResponse(["InvalidSearch"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);

const ZoneDockSearchParams = t.Object({ zoneId: Uuid, blockKey: BlockKey });
const ZoneFeedBlockParams = ZoneDockSearchParams;
const ZonePageSearchParams = t.Object({
	zoneId: Uuid,
	pageId: Uuid,
	blockKey: BlockKey,
});
const SearchFeatureTemplateParams = t.Object({ template: SearchTemplateId });
const SharedSearchQueryParams = t.Object({ id: Uuid });
const SharedSearchQueryResponse = t.Object({
	id: Uuid,
	document: SharedSearchQueryDocument,
	createdAt: DateTime,
});
const SearchFeatureExecutionBody = t.Omit(SearchFeatureInput, ["document"]);
const ZoneSearchFeatureParams = t.Object({ zoneId: Uuid });
const ZoneSearchFeatureExecutionBody = t.Pick(SearchFeatureInput, ["injections", "state"]);
const ZoneFeedBlockExecutionBody = t.Object(
	{
		...ZoneSearchFeatureExecutionBody.properties,
		contentKinds: t.Optional(
			t.Array(t.UnionEnum(SimpleFeedContentKindValues), {
				maxItems: SimpleFeedContentKindValues.length,
				uniqueItems: true,
			}),
		),
		surface: t.Union([
			t.Object({ kind: t.Literal("dock") }, { additionalProperties: false }),
			t.Object(
				{
					kind: t.Literal("page"),
					pageId: Uuid,
				},
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false },
);
const SearchDocumentModel = Type.Object(
	{
		...SearchDocument.properties,
		filter: Type.Optional(Type.Ref("UnitFilter")),
	},
	{ additionalProperties: false, $id: "SearchDocumentV1" },
);
const SearchFeatureDefinitionModel = Type.Object(
	{
		document: Type.Ref("SearchDocumentV1"),
		controls: SearchFeatureDefinition.properties.controls,
	},
	{ additionalProperties: false, $id: "SearchFeatureDefinitionV1" },
);
const SearchDocumentInput = Type.Unsafe<Static<typeof SearchDocument>>(
	Type.Ref("SearchDocumentV1"),
);
const SearchFeatureDefinitionResponse = Type.Unsafe<unknown>(Type.Ref("SearchFeatureDefinitionV1"));
const ZoneSearchFeatureResponse = t.Object({
	zoneId: Uuid,
	searchDocumentId: Uuid,
	enabled: t.Boolean(),
	definition: SearchFeatureDefinitionResponse,
	latestRevisionId: Uuid,
	createdAt: DateTime,
	updatedAt: DateTime,
});
const ZoneSearchFeaturePutBody = t.Object(
	{
		document: SearchDocumentInput,
		baseRevisionId: t.Optional(Uuid),
		message: t.Optional(t.String({ maxLength: 500 })),
	},
	{ additionalProperties: false },
);
const ZoneSearchFeatureRestoreBody = t.Object(
	{
		sourceRevisionId: Uuid,
		baseRevisionId: Uuid,
		message: t.Optional(t.String({ maxLength: 500 })),
	},
	{ additionalProperties: false },
);
const ZoneSearchFeatureRevisionListResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			parentRevisionId: t.Nullable(Uuid),
			sourceRevisionId: t.Nullable(Uuid),
			actorProfileId: t.Nullable(Uuid),
			kind: t.UnionEnum(["create", "update", "delete", "restore"]),
			editSummary: t.Nullable(t.String()),
			createdAt: DateTime,
		}),
	),
});

function presentSharedSearchQuery(record: SharedSearchQueryProjection) {
	return {
		id: record.id,
		document: record.document,
		createdAt: record.createdAt,
	} satisfies typeof SharedSearchQueryResponse.static;
}

function presentZoneSearchFeature(record: ZoneSearchFeatureProjection) {
	return {
		zoneId: record.zoneId,
		searchDocumentId: record.searchDocumentId,
		enabled: record.enabled,
		definition: resolveSearchDocument(record.document),
		latestRevisionId: record.latestRevisionId,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	} satisfies typeof ZoneSearchFeatureResponse.static;
}

async function executeZoneBlock(input: {
	zoneId: string;
	blockKey: string;
	document: { readonly blocks: readonly Block[] };
	body: unknown;
	profileId?: string;
	source?: SearchFeatureSource;
	additionalDomainFilter?: UnitFilter;
}) {
	const source = input.source ?? findSearchFeatureSource(input.document, input.blockKey);
	const baseDocument =
		source.kind === "template"
			? createDefaultSearchDocument(source.template)
			: await database.transaction(async (tx) => {
					const feature = await getZoneSearchFeature(tx, input.zoneId);
					if (!feature || !feature.enabled) throw new ZoneSearchFeatureNotFound();
					return feature.document;
				});
	const request = input.body as typeof ZoneSearchFeatureExecutionBody.static;
	return executeSearchFeatureInput(
		{
			document: baseDocument,
			contexts: [{ kind: "zone", zoneId: input.zoneId }],
			injections: request.injections,
			state: request.state,
		},
		input.profileId,
		input.additionalDomainFilter,
	);
}

async function executeZoneFeedBlock(input: {
	zoneId: string;
	blockKey: string;
	document: { readonly blocks: readonly Block[] };
	body: unknown;
	profileId?: string;
}) {
	const block = findFeedBlock(input.document, input.blockKey);
	const request = input.body as typeof ZoneFeedBlockExecutionBody.static;
	const result = await executeZoneBlock({
		...input,
		source: block.feature,
		additionalDomainFilter: createSimpleFeedFilter({
			contentKinds: request.contentKinds,
		}),
	});
	return presentSearchResultAsFeed(result, input.profileId);
}

async function presentSearchResultAsFeed(
	result: Awaited<ReturnType<typeof executeSearchFeatureInput>>,
	profileId?: string,
) {
	const seen = new Set<string>();
	const candidates = result.groups.flatMap((group) =>
		group.hits.flatMap((hit) => {
			if (seen.has(hit.id)) return [];
			seen.add(hit.id);
			return [{ id: hit.id, realmId: null }];
		}),
	);
	const viewer = await resolveRecommendationViewer(profileId, false);
	const items = await hydrateFeedItems(
		candidates,
		viewer,
		{ content: FeedContentKindValues },
		new Date(),
		{ kind: "contextual" },
	);
	return {
		items,
		nextCursor: result.nextCursor,
		facets: result.facets,
		total: result.groups.reduce((total, group) => total + Number(group.total.value), 0),
	};
}

export default new Elysia({ prefix: "/search" })
	.model({
		...FilterSchemaModels,
		SearchDocumentV1: SearchDocumentModel,
		SearchFeatureDefinitionV1: SearchFeatureDefinitionModel,
	})
	.get(
		"/features/:template",
		({ params }) => resolveSearchDocument(createDefaultSearchDocument(params.template)),
		{
			params: SearchFeatureTemplateParams,
			response: { [StatusCodes.OK]: SearchFeatureDefinitionResponse },
			detail: { summary: "Get a system Search Feature template", tags: ["Search"] },
		},
	)
	.post(
		"/features/:template/execute",
		async ({ params, body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await executeSearchFeatureInput(
					{
						document: createDefaultSearchDocument(params.template),
						...body,
					},
					identity.authorization.profileId,
				);
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable)
					throw cause;
				logSearchFailure("Search Feature execution failed", "search.feature.failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: SearchFeatureTemplateParams,
			body: SearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a system Search Feature template", tags: ["Search"] },
		},
	)
	.post(
		"/features/:template/feed",
		async ({ params, body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				const result = await executeSearchFeatureInput(
					{
						document: createDefaultSearchDocument(params.template),
						...body,
					},
					identity.authorization.profileId,
				);
				return presentSearchResultAsFeed(result, identity.authorization.profileId);
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable)
					throw cause;
				logSearchFailure(
					"Search Feature Feed presentation failed",
					"search.feature_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: SearchFeatureTemplateParams,
			body: SearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchFeedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Present a system Search Feature as a Feed", tags: ["Search"] },
		},
	)
	.get(
		"/zones/:zoneId/feature",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const feature = await database.transaction((tx) =>
				getZoneSearchFeature(tx, params.zoneId),
			);
			if (!feature) throw new ZoneSearchFeatureNotFound();
			return presentZoneSearchFeature(feature);
		},
		{
			params: ZoneSearchFeatureParams,
			response: {
				[StatusCodes.OK]: ZoneSearchFeatureResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ZoneSearchFeatureNotFound",
				]),
			},
			detail: { summary: "Get a Zone Search Feature", tags: ["Search", "Zones"] },
		},
	)
	.put(
		"/zones/:zoneId/feature",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:update");
			await identity.authorization.unit.ensureCanUpdate(params.zoneId, [["zone", "search"]]);
			const actorProfileId = identity.authorization.profileId;
			if (!actorProfileId) throw new UnitNotFound("Profile");
			return presentZoneSearchFeature(
				await putZoneSearchFeature({
					zoneId: params.zoneId,
					enabled: true,
					document: body.document,
					baseRevisionId: body.baseRevisionId,
					actorProfileId,
					message: body.message,
				}),
			);
		},
		{
			params: ZoneSearchFeatureParams,
			body: ZoneSearchFeaturePutBody,
			response: {
				[StatusCodes.OK]: ZoneSearchFeatureResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["SearchDocumentRevisionConflict"]),
			},
			detail: { summary: "Configure a Zone Search Feature", tags: ["Search", "Zones"] },
		},
	)
	.post(
		"/zones/:zoneId/feature/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const feature = await database.transaction((tx) =>
				getZoneSearchFeature(tx, params.zoneId),
			);
			if (!feature || !feature.enabled) throw new ZoneSearchFeatureNotFound();
			return executeSearchFeatureInput(
				{
					document: feature.document,
					contexts: [{ kind: "zone", zoneId: params.zoneId }],
					injections: body.injections,
					state: body.state,
				},
				identity.authorization.profileId,
			);
		},
		{
			params: ZoneSearchFeatureParams,
			body: ZoneSearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ZoneSearchFeatureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a Zone Search Feature", tags: ["Search", "Zones"] },
		},
	)
	.get(
		"/zones/:zoneId/feature/revisions",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:update");
			await identity.authorization.unit.ensureCanUpdate(params.zoneId, [["zone", "search"]]);
			const revisions = await database.transaction((tx) =>
				listZoneSearchFeatureRevisions(tx, params.zoneId),
			);
			if (!revisions) throw new ZoneSearchFeatureNotFound();
			return { items: revisions.items };
		},
		{
			params: ZoneSearchFeatureParams,
			response: {
				[StatusCodes.OK]: ZoneSearchFeatureRevisionListResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ZoneSearchFeatureNotFound",
				]),
			},
			detail: { summary: "List Zone Search Feature revisions", tags: ["Search", "Zones"] },
		},
	)
	.post(
		"/zones/:zoneId/feature/restore",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:update");
			await identity.authorization.unit.ensureCanUpdate(params.zoneId, [["zone", "search"]]);
			const actorProfileId = identity.authorization.profileId;
			if (!actorProfileId) throw new UnitNotFound("Profile");
			return presentZoneSearchFeature(
				await restoreZoneSearchFeature({
					zoneId: params.zoneId,
					sourceRevisionId: body.sourceRevisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId,
					message: body.message,
				}),
			);
		},
		{
			params: ZoneSearchFeatureParams,
			body: ZoneSearchFeatureRestoreBody,
			response: {
				[StatusCodes.OK]: ZoneSearchFeatureResponse,
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ZoneSearchFeatureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["SearchDocumentRevisionConflict"]),
			},
			detail: {
				summary: "Restore a Zone Search Feature revision",
				tags: ["Search", "Zones"],
			},
		},
	)
	.post(
		"/zones/:zoneId/dock/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const [record] = await database
				.select({ document: unitDock.document })
				.from(unitDock)
				.where(
					and(
						eq(unitDock.unitId, params.zoneId),
						eq(unitDock.kind, "main"),
						isNull(unitDock.deletedAt),
					),
				)
				.limit(1);
			if (!record) throw new DockNotFound();
			try {
				return await executeZoneBlock({
					...params,
					document: parseDocument(DockDocument, record.document),
					body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof DockNotFound ||
					cause instanceof ZoneSearchFeatureNotFound
				)
					throw cause;
				logSearchFailure(
					"Zone Dock Search Block execution failed",
					"search.zone_dock.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZoneDockSearchParams,
			body: ZoneSearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"DockNotFound",
					"ZoneSearchFeatureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Dock Search Block", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/pages/:pageId/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const record = await database.transaction((tx) =>
				getZonePageUnitById(tx, params.zoneId, params.pageId),
			);
			if (!record) throw new ZonePageNotFound();
			try {
				return await executeZoneBlock({
					...params,
					document: record.document,
					body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof ZonePageNotFound ||
					cause instanceof ZoneSearchFeatureNotFound
				)
					throw cause;
				logSearchFailure(
					"Zone Page Search Block execution failed",
					"search.zone_page.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZonePageSearchParams,
			body: ZoneSearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"ZonePageNotFound",
					"ZoneSearchFeatureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Page Search Block", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/feed-blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			try {
				const surface = body.surface;
				const document =
					surface.kind === "dock"
						? await (async () => {
								const [record] = await database
									.select({ document: unitDock.document })
									.from(unitDock)
									.where(
										and(
											eq(unitDock.unitId, params.zoneId),
											eq(unitDock.kind, "main"),
											isNull(unitDock.deletedAt),
										),
									)
									.limit(1);
								if (!record) throw new DockNotFound();
								return parseDocument(DockDocument, record.document);
							})()
						: await database.transaction(async (tx) => {
								const record = await getZonePageUnitById(
									tx,
									params.zoneId,
									surface.pageId,
								);
								if (!record) throw new ZonePageNotFound();
								return record.document;
							});
				return await executeZoneFeedBlock({
					...params,
					document,
					body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof DockNotFound ||
					cause instanceof ZonePageNotFound ||
					cause instanceof ZoneSearchFeatureNotFound
				)
					throw cause;
				logSearchFailure(
					"Zone Feed Block execution failed",
					"search.zone_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZoneFeedBlockParams,
			body: ZoneFeedBlockExecutionBody,
			response: {
				[StatusCodes.OK]: SearchFeedResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"DockNotFound",
					"ZonePageNotFound",
					"ZoneSearchFeatureNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Feed Block", tags: ["Feed"] },
		},
	)
	.post(
		"",
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await searchGrouped({
					...body,
					profileId: identity.authorization.profileId,
					indexes: body.indexes ?? [...SearchCategories],
				});
			} catch (error) {
				if (error instanceof InvalidSearch || error instanceof SearchUnavailable)
					throw error;
				logSearchFailure("Grouped search failed", "search.grouped.failed", error);
				throw new SearchUnavailable(error);
			}
		},
		{
			body: GroupedSearchBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search across public categories", tags: ["Search"] },
		},
	)
	.post(
		"/shared-queries",
		async ({ body, request, set, status }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			const createdByProfileId = identity.authorization.profileId;
			if (!createdByProfileId) throw new AuthenticationRequired();
			const created = await createSharedSearchQuery(database, {
				document: body,
				createdByProfileId,
			});
			set.headers.location = `/api/search/shared-queries/${created.id}`;
			return status(StatusCodes.CREATED, presentSharedSearchQuery(created));
		},
		{
			body: SharedSearchQueryDocument,
			response: {
				[StatusCodes.CREATED]: SharedSearchQueryResponse,
				[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["AuthenticationRequired"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Create an immutable shared Search query", tags: ["Search"] },
		},
	)
	.get(
		"/shared-queries/:id",
		async ({ params }) => {
			const record = await getSharedSearchQuery(database, params.id);
			if (!record) throw new SharedSearchQueryNotFound();
			return presentSharedSearchQuery(record);
		},
		{
			params: SharedSearchQueryParams,
			response: {
				[StatusCodes.OK]: SharedSearchQueryResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SharedSearchQueryNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Get a shared Search query", tags: ["Search"] },
		},
	)
	.post(
		"/:index",
		async ({ params, body, request }) => {
			try {
				const identity = await resolveIdentity(request.headers, "unit:read");
				return await searchDomain(params.index, {
					...body,
					profileId: identity.authorization.profileId,
				});
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable)
					throw cause;
				logSearchFailure("Domain search failed", "search.domain.failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: DomainSearchParams,
			body: DomainSearchBody,
			response: {
				[StatusCodes.OK]: DomainSearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search one public category", tags: ["Search"] },
		},
	);
