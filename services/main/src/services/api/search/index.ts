import { DevelopmentPreviewCapability } from "@rezics/access";
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
	FilterDocument,
	SearchFeatureDefinition,
	SearchFeatureInput,
	SearchFeatureSurface,
	parseFilterDocument,
	readSearchLanguageBoundary,
	readUnitLanguageBoundary,
	SearchControlExpression,
	SharedSearchQueryDocument,
	type SearchFeatureState,
} from "@rezics/filter";
import { FilterSchemaModels } from "@rezics/filter";
import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { getActiveObservability } from "@rezics/observability";
import { type Static, Type } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { and, eq, isNull } from "drizzle-orm";
import { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import {
	contentRatingPolicyFromAllowlist,
	resolveContentRatingPolicy,
} from "../../content-rating/policy";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { AuthenticationRequired } from "../../auth/errors";
import { InvalidSearch, SearchUnavailable, SharedSearchQueryNotFound } from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain, searchGrouped } from "../../search/service";
import {
	executeSearchFeatureFeedInput,
	executeSearchFeatureInput,
	resolveFilterDocument,
	type GroupedSearchExecutionPolicy,
} from "../../search/filter-document";
import {
	createSharedSearchQuery,
	getSharedSearchQuery,
	type SharedSearchQueryProjection,
} from "../../search/shared-queries";
import { database } from "../../database";
import { unitDock, zone } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { getZonePageUnitById } from "../../zones/pages";
import { ZonePageNotFound } from "../domain-extensions/errors";
import { DockNotFound } from "../docks/errors";
import { hydrateFeedItems } from "../feed";
import { resolveFeedPageContinuation } from "../feed/continuation";
import { FeedContentKindValues } from "../feed/schema";
import { DateTime, LocalizationLanguageHints, Uuid } from "../schema";
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

const ZoneDockSearchParams = t.Object({ zoneId: Uuid, blockKey: BlockKey });
const ZoneFeedBlockParams = ZoneDockSearchParams;
const ZonePageSearchParams = t.Object({
	zoneId: Uuid,
	pageId: Uuid,
	blockKey: BlockKey,
});
const SharedSearchQueryParams = t.Object({ id: Uuid });
const SharedSearchQueryResponse = t.Object({
	id: Uuid,
	document: SharedSearchQueryDocument,
	createdAt: DateTime,
});
const SearchFeatureExecutionBody = t.Object(
	{
		...SearchFeatureInput.properties,
		filterDocument: Type.Ref("FilterDocument"),
		localizationLanguages: t.Optional(LocalizationLanguageHints),
	},
	{ additionalProperties: false },
);
const SearchFeatureFeedPresentationBody = t.Object(
	{
		...SearchFeatureExecutionBody.properties,
		surface: SearchFeatureSurface,
	},
	{ additionalProperties: false },
);
const ZoneFilterParams = t.Object({ zoneId: Uuid });
const ZoneFilterExecutionBody = t.Object(
	{
		...t.Pick(SearchFeatureInput, ["injections", "state"]).properties,
		localizationLanguages: t.Optional(LocalizationLanguageHints),
	},
	{ additionalProperties: false },
);
const ZoneFilterFeedPresentationBody = t.Object(
	{
		...ZoneFilterExecutionBody.properties,
		surface: SearchFeatureSurface,
	},
	{ additionalProperties: false },
);
const ZoneFeedBlockExecutionBody = t.Object(
	{
		...ZoneFilterExecutionBody.properties,
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
const FilterDocumentModel = Type.Object(
	{
		...FilterDocument.properties,
		where: Type.Optional(Type.Ref("UnitPredicate")),
	},
	{ additionalProperties: false, $id: "FilterDocument" },
);
const SearchFeatureDefinitionModel = Type.Object(
	{
		...SearchFeatureDefinition.properties,
		filterDocument: Type.Ref("FilterDocument"),
	},
	{ additionalProperties: false, $id: "SearchFeatureDefinition" },
);
const FilterDocumentInput = Type.Unsafe<Static<typeof FilterDocument>>(Type.Ref("FilterDocument"));
const SearchFeatureDefinitionResponse = Type.Unsafe<unknown>(Type.Ref("SearchFeatureDefinition"));

function presentSharedSearchQuery(record: SharedSearchQueryProjection) {
	return {
		id: record.id,
		document: record.document,
		createdAt: record.createdAt,
	} satisfies typeof SharedSearchQueryResponse.static;
}

async function getZoneFilterDocument(zoneId: string) {
	const [record] = await database
		.select({ filterDocument: zone.filterDocument })
		.from(zone)
		.where(eq(zone.id, zoneId))
		.limit(1);
	if (!record) throw new UnitNotFound("Zone");
	return parseFilterDocument(record.filterDocument);
}

interface ZoneBlockExecutionInput {
	zoneId: string;
	blockKey: string;
	document: { readonly blocks: readonly Block[] };
	body: unknown;
	profileId?: string;
	hasDevelopmentPreviewAccess: boolean;
	source?: SearchFeatureSource;
}

async function resolveZoneBlockExecution(input: ZoneBlockExecutionInput) {
	const source = input.source ?? findSearchFeatureSource(input.document, input.blockKey);
	const filterDocument =
		source.kind === "global"
			? {}
			: source.kind === "inline"
				? source.filterDocument
				: await getZoneFilterDocument(input.zoneId);
	const request = input.body as typeof ZoneFilterExecutionBody.static;
	return {
		featureInput: {
			filterDocument,
			contexts: [{ kind: "zone", zoneId: input.zoneId }],
			injections: request.injections,
			state: request.state,
		},
		localizationLanguages: request.localizationLanguages ?? [],
		request,
	};
}

async function executeZoneBlock(
	input: ZoneBlockExecutionInput & {
		execution: GroupedSearchExecutionPolicy;
	},
) {
	const resolved = await resolveZoneBlockExecution(input);
	return executeSearchFeatureInput(
		resolved.featureInput,
		input.execution,
		resolved.localizationLanguages,
		input.profileId,
		input.hasDevelopmentPreviewAccess,
	);
}

async function executeZoneFeedBlock(input: {
	zoneId: string;
	blockKey: string;
	document: { readonly blocks: readonly Block[] };
	body: unknown;
	profileId?: string;
	hasDevelopmentPreviewAccess: boolean;
}) {
	const block = findFeedBlock(input.document, input.blockKey);
	const resolved = await resolveZoneBlockExecution({
		...input,
		source: block.feature,
	});
	const result = await executeSearchFeatureFeedInput(
		resolved.featureInput,
		{ sortProfile: "feed", pageBudget: "global" },
		resolved.localizationLanguages,
		input.profileId,
		input.hasDevelopmentPreviewAccess,
	);
	return presentSearchResultAsFeed(
		result,
		resolved.localizationLanguages,
		resolved.request.state,
		input.profileId,
	);
}

async function presentSearchResultAsFeed(
	result: Awaited<ReturnType<typeof executeSearchFeatureFeedInput>>,
	localizationLanguages: readonly ContentLanguage[],
	state: Readonly<{
		filter?: SearchFeatureState["filter"];
		expression?: unknown;
	}>,
	profileId?: string,
) {
	const candidates = result.hits.map(({ id }) => ({
		id,
		realmId: null,
	}));
	const viewer = await resolveRecommendationViewer(profileId, false);
	const expression = state.expression;
	if (expression !== undefined && !Check(SearchControlExpression, expression))
		throw new InvalidSearch("Invalid Search language expression");
	const allowedLanguages = [
		...new Set(
			[
				...(readSearchLanguageBoundary(expression) ?? []),
				...(readUnitLanguageBoundary(state.filter?.where) ?? []),
			].filter(isContentLanguage),
		),
	];
	const items = await hydrateFeedItems(
		candidates,
		viewer,
		{
			content: FeedContentKindValues,
			localizationLanguages,
			...(allowedLanguages.length ? { languages: allowedLanguages } : {}),
		},
		new Date(),
		{ kind: "contextual" },
	);
	const continuation = resolveFeedPageContinuation(items, result.nextCursor);
	return {
		items,
		...(continuation.status === "available" ? { nextCursor: continuation.cursor } : {}),
		facets: result.facets,
		total: result.total,
	};
}

export default new Elysia({ prefix: "/search" })
	.model({
		...FilterSchemaModels,
		FilterDocument: FilterDocumentModel,
		SearchFeatureDefinition: SearchFeatureDefinitionModel,
	})
	.get(
		"/filter",
		async ({ request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return resolveFilterDocument({}, hasDevelopmentPreviewAccess);
		},
		{
			response: { [StatusCodes.OK]: SearchFeatureDefinitionResponse },
			detail: { summary: "Get the global Filter capability definition", tags: ["Search"] },
		},
	)
	.post(
		"/filter/definition",
		async ({ body, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return resolveFilterDocument(body, hasDevelopmentPreviewAccess);
		},
		{
			body: FilterDocumentInput,
			response: {
				[StatusCodes.OK]: SearchFeatureDefinitionResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Resolve a Filter document", tags: ["Search"] },
		},
	)
	.post(
		"/filter/execute",
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request, "unit:read", "search.execute");
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				const { localizationLanguages: requestedLanguages, ...featureInput } = body;
				const localizationLanguages = requestedLanguages ?? [];
				return await executeSearchFeatureInput(
					featureInput,
					{ sortProfile: "search", pageBudget: "per-category" },
					localizationLanguages,
					identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				);
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable) throw cause;
				logSearchFailure("Search Feature execution failed", "search.feature.failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			body: SearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a Filter document", tags: ["Search"] },
		},
	)
	.post(
		"/filter/feed",
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request, "unit:read", "search.execute");
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				const { surface, localizationLanguages: requestedLanguages, ...featureInput } = body;
				const localizationLanguages = requestedLanguages ?? [];
				const result = await executeSearchFeatureFeedInput(
					featureInput,
					{ sortProfile: surface, pageBudget: "global" },
					localizationLanguages,
					identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				);
				return presentSearchResultAsFeed(
					result,
					localizationLanguages,
					body.state,
					identity.authorization.profileId,
				);
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable) throw cause;
				logSearchFailure(
					"Search Feature Feed presentation failed",
					"search.feature_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			body: SearchFeatureFeedPresentationBody,
			response: {
				[StatusCodes.OK]: SearchFeedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Present a Filter document as a Feed", tags: ["Search"] },
		},
	)
	.get(
		"/zones/:zoneId/filter",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return resolveFilterDocument(
				await getZoneFilterDocument(params.zoneId),
				hasDevelopmentPreviewAccess,
			);
		},
		{
			params: ZoneFilterParams,
			response: {
				[StatusCodes.OK]: SearchFeatureDefinitionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Get a Zone Filter definition", tags: ["Search", "Zones"] },
		},
	)
	.post(
		"/zones/:zoneId/filter/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return executeSearchFeatureInput(
				{
					filterDocument: await getZoneFilterDocument(params.zoneId),
					contexts: [{ kind: "zone", zoneId: params.zoneId }],
					injections: body.injections,
					state: body.state,
				},
				{ sortProfile: "search", pageBudget: "per-category" },
				body.localizationLanguages ?? [],
				identity.authorization.profileId,
				hasDevelopmentPreviewAccess,
			);
		},
		{
			params: ZoneFilterParams,
			body: ZoneFilterExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a Zone Filter", tags: ["Search", "Zones"] },
		},
	)
	.post(
		"/zones/:zoneId/filter/feed",
		async ({ params, body, request }) => {
			try {
				const identity = await resolveIdentity(request, "unit:read", "search.execute");
				await identity.authorization.unit.ensureCanRead(
					params.zoneId,
					() => new UnitNotFound("Zone"),
				);
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				const localizationLanguages = body.localizationLanguages ?? [];
				const result = await executeSearchFeatureFeedInput(
					{
						filterDocument: await getZoneFilterDocument(params.zoneId),
						contexts: [{ kind: "zone", zoneId: params.zoneId }],
						injections: body.injections,
						state: body.state,
					},
					{ sortProfile: body.surface, pageBudget: "global" },
					localizationLanguages,
					identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				);
				return presentSearchResultAsFeed(
					result,
					localizationLanguages,
					body.state,
					identity.authorization.profileId,
				);
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound
				)
					throw cause;
				logSearchFailure(
					"Zone Filter Feed presentation failed",
					"search.zone_filter_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: ZoneFilterParams,
			body: ZoneFilterFeedPresentationBody,
			response: {
				[StatusCodes.OK]: SearchFeedResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: {
				summary: "Present a Zone Filter as a Feed",
				tags: ["Search", "Zones"],
			},
		},
	)
	.post(
		"/zones/:zoneId/dock/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
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
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				return await executeZoneBlock({
					...params,
					document: parseDocument(DockDocument, record.document),
					body,
					execution: { sortProfile: "search", pageBudget: "per-category" },
					profileId: identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof DockNotFound
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
			body: ZoneFilterExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Dock Search Block", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/pages/:pageId/blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const record = await database.transaction((tx) =>
				getZonePageUnitById(tx, params.zoneId, params.pageId),
			);
			if (!record) throw new ZonePageNotFound();
			try {
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				return await executeZoneBlock({
					...params,
					document: record.document,
					body,
					execution: { sortProfile: "search", pageBudget: "per-category" },
					profileId: identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof ZonePageNotFound
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
			body: ZoneFilterExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Page Search Block", tags: ["Search"] },
		},
	)
	.post(
		"/zones/:zoneId/feed-blocks/:blockKey/execute",
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
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
								const record = await getZonePageUnitById(tx, params.zoneId, surface.pageId);
								if (!record) throw new ZonePageNotFound();
								return record.document;
							});
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				return await executeZoneFeedBlock({
					...params,
					document,
					body,
					profileId: identity.authorization.profileId,
					hasDevelopmentPreviewAccess,
				});
			} catch (cause) {
				if (
					cause instanceof InvalidSearch ||
					cause instanceof SearchUnavailable ||
					cause instanceof UnitNotFound ||
					cause instanceof DockNotFound ||
					cause instanceof ZonePageNotFound
				)
					throw cause;
				logSearchFailure("Zone Feed Block execution failed", "search.zone_feed.failed", cause);
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
				const identity = await resolveIdentity(request, "unit:read", "search.execute");
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				const indexes = (body.indexes ?? [...SearchCategories]).filter(
					(index) => hasDevelopmentPreviewAccess || index !== "tag-structures",
				);
				const viewer = await resolveRecommendationViewer(identity.authorization.profileId, false);
				return await searchGrouped({
					...body,
					profileId: identity.authorization.profileId,
					contentRatingPolicy: contentRatingPolicyFromAllowlist(viewer.contentRatings),
					indexes,
					localizationLanguages: body.localizationLanguages ?? [],
				});
			} catch (error) {
				if (error instanceof InvalidSearch || error instanceof SearchUnavailable) throw error;
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
			const identity = await resolveIdentity(request, "unit:read");
			const createdByProfileId = identity.authorization.profileId;
			if (!createdByProfileId) throw new AuthenticationRequired();
			const created = await createSharedSearchQuery(database, {
				document: body,
				createdByProfileId,
			});
			set.headers.location = `/api/v1/search/shared-queries/${created.id}`;
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
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
			if (params.index === "tag-structures") {
				if (!identity.profile) throw new AuthenticationRequired();
				await identity.authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			}
			try {
				const viewer = await resolveRecommendationViewer(identity.authorization.profileId, false);
				return await searchDomain(params.index, {
					...body,
					profileId: identity.authorization.profileId,
					contentRatingPolicy: resolveContentRatingPolicy(
						viewer.contentRatings,
						body.contentRatings,
					),
				});
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable) throw cause;
				logSearchFailure("Domain search failed", "search.domain.failed", cause);
				throw new SearchUnavailable(cause);
			}
		},
		{
			params: DomainSearchParams,
			body: DomainSearchBody,
			response: {
				[StatusCodes.OK]: DomainSearchResponse,
				[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["AuthenticationRequired"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search one public category", tags: ["Search"] },
		},
	);
