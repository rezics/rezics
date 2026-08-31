import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";
import { DevelopmentPreviewCapability } from "@rezics/access";
import {
	BlockPath,
	DockDocument,
	MaxZoneEagerBlockExecutions,
	parseDocument,
	type BlockPath as BlockPathValue,
	type SearchFeatureSource,
	type UnitReferencedBlock,
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
	SearchFeatureState,
	unitFilterSearchQuery,
	type SearchSort,
} from "@rezics/filter";
import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { getActiveObservability } from "@rezics/observability";
import { type StaticDecode, Type } from "typebox";
import { Check } from "typebox/value";
import { and, eq, isNull } from "drizzle-orm";
import { t } from "elysia";

import { AuthenticationRequired } from "../../auth/errors";
import {
	OptionalApiTokenOrSessionSecurity,
	resolveIdentity,
	resolveIdentityWithDynamicApiQuota,
} from "../../auth/session";
import type { Authorization } from "../../authorization";
import {
	contentRatingPolicyFromAllowlist,
	resolveContentRatingPolicy,
} from "../../content-rating/policy";
import { resolveRecommendationViewer } from "../../recommendations/context";
import { InvalidSearch, SearchUnavailable, SharedSearchQueryNotFound } from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain, searchGrouped } from "../../search/service";
import {
	getSearchTagMatchReasons,
	getTagPositionAvailability,
} from "../../search/tag-match-reasons";
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
import { UnitNotFound, UnitRevisionConflict } from "../../units/errors";
import { getZonePageUnitById } from "../../zones/pages";
import { ZonePageNotFound } from "../domain-extensions/errors";
import { DockNotFound } from "../docks/errors";
import { hydrateFeedItems } from "../feed";
import { resolveFeedPageContinuation } from "../feed/continuation";
import { FeedContentKindValues } from "../feed/schema";
import { DateTime, LocalizationLanguageHints, Uuid } from "../schema";
import { findFeedBlock, findSearchUnitListBlock } from "./block-source";
import {
	DomainSearchBody,
	DomainSearchParams,
	GroupedSearchBody,
	ZoneDerivedSelectionSeed,
	ZoneFeedBlockExecutionResponse,
	ZonePageAggregateExecutionBody,
	ZonePageAggregateExecutionParams,
	ZonePageAggregateExecutionResponse,
	ZoneSearchBlockExecutionResponse,
} from "./schema";
import { resolveDerivedSearchSource, type DerivedSearchResourceContext } from "./derived-source";
import {
	executeZonePageAggregate,
	loadZonePageExecutionSurface,
	selectZonePageBlockExecutions,
} from "./zone-page-execution";
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
const UnitRevisionConflictResponse = toApiErrorResponse(["UnitRevisionConflict"]);

const ZoneDockSearchParams = t.Object({ zoneId: Uuid });
const ZonePageSearchParams = t.Object({
	zoneId: Uuid,
	pageId: Uuid,
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
		filterDocument: FilterDocument,
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
const ZonePersistedBlockExecutionBody = t.Object(
	{
		state: SearchFeatureState,
		localizationLanguages: t.Optional(LocalizationLanguageHints),
		selectionSeed: t.Optional(ZoneDerivedSelectionSeed),
	},
	{ additionalProperties: false },
);
const ZoneBlockExecutionBody = t.Object(
	{
		...ZonePersistedBlockExecutionBody.properties,
		path: BlockPath,
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
const FilterDocumentInput = Type.Unsafe<StaticDecode<typeof FilterDocument>>(FilterDocument);
const SearchFeatureDefinitionResponse = Type.Unsafe<unknown>(SearchFeatureDefinition);

function presentSharedSearchQuery(record: SharedSearchQueryProjection) {
	return {
		id: record.id,
		document: record.document,
		createdAt: record.createdAt,
	} satisfies StaticDecode<typeof SharedSearchQueryResponse>;
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
	blockPath: BlockPathValue;
	document: { readonly blocks: readonly UnitReferencedBlock[] };
	body: unknown;
	authorization: Authorization;
	resource: DerivedSearchResourceContext;
	profileId?: string;
	hasDevelopmentPreviewAccess: boolean;
	persistedSort?: SearchSort;
	source?: SearchFeatureSource;
}

async function resolveZoneBlockExecution(input: ZoneBlockExecutionInput) {
	const persistedSource = input.source
		? undefined
		: findSearchUnitListBlock(input.document, input.blockPath).source;
	const configuredSource =
		input.source ??
		(persistedSource?.kind === "search" ? persistedSource.feature : persistedSource);
	if (!configuredSource) throw new InvalidSearch("The selected Block has no Search source");
	const request = input.body as StaticDecode<typeof ZonePersistedBlockExecutionBody>;
	const derived =
		configuredSource.kind === "derived"
			? await resolveDerivedSearchSource({
					authorization: input.authorization,
					localizationLanguages: request.localizationLanguages ?? [],
					path: input.blockPath,
					resource: input.resource,
					selectionSeed: request.selectionSeed,
					source: configuredSource,
				})
			: {
					feature: configuredSource,
					hidden: false,
					injections: [],
				};
	const source = derived.feature;
	const filterDocument =
		source.kind === "global"
			? {}
			: source.kind === "inline"
				? source.filterDocument
				: await getZoneFilterDocument(input.zoneId);
	return {
		featureInput: {
			filterDocument,
			contexts: [{ kind: "zone", zoneId: input.zoneId }],
			// Persisted Block routes accept viewer state only. Trusted selector
			// injections are derived here from the stored source, never from the client.
			injections: [...derived.injections],
			state: request.state,
		},
		hidden: derived.hidden,
		localizationLanguages: request.localizationLanguages ?? [],
		request,
		persistedSort:
			input.persistedSort ??
			("sort" in derived ? derived.sort : undefined) ??
			(persistedSource?.kind === "search" ? persistedSource.sort : persistedSource?.query.sort),
		...("selected" in derived && derived.selected ? { selected: derived.selected } : {}),
		...("selectionSeed" in derived && derived.selectionSeed
			? { selectionSeed: derived.selectionSeed }
			: {}),
	};
}

async function executeZoneBlock(
	input: ZoneBlockExecutionInput & {
		execution: GroupedSearchExecutionPolicy;
	},
) {
	const resolved = await resolveZoneBlockExecution(input);
	if (resolved.hidden)
		return {
			groups: [],
			hidden: true as const,
			query: unitFilterSearchQuery(resolved.request.state.filter),
			...(resolved.selected ? { selected: resolved.selected } : {}),
			...(resolved.selectionSeed ? { selectionSeed: resolved.selectionSeed } : {}),
		};
	const result = await executeSearchFeatureInput(
		resolved.featureInput,
		{
			...input.execution,
			...(resolved.persistedSort
				? {
						persistedSort: {
							sort: resolved.persistedSort,
							behavior: "authoritative" as const,
						},
					}
				: {}),
		},
		resolved.localizationLanguages,
		input.profileId,
		input.hasDevelopmentPreviewAccess,
	);
	return {
		...result,
		...(resolved.selected ? { selected: resolved.selected } : {}),
		...(resolved.selectionSeed ? { selectionSeed: resolved.selectionSeed } : {}),
	};
}

async function executeZoneFeedBlock(input: {
	zoneId: string;
	blockPath: BlockPathValue;
	document: { readonly blocks: readonly UnitReferencedBlock[] };
	body: unknown;
	authorization: Authorization;
	resource: DerivedSearchResourceContext;
	profileId?: string;
	hasDevelopmentPreviewAccess: boolean;
}) {
	const block = findFeedBlock(input.document, input.blockPath);
	const persistedInitialSort =
		block.initialSort ?? (block.feature.kind === "derived" ? block.feature.query.sort : undefined);
	const resolved = await resolveZoneBlockExecution({
		...input,
		source: block.feature,
		persistedSort: persistedInitialSort,
	});
	if (resolved.hidden)
		return {
			items: [],
			total: { kind: "exact" as const, value: 0 },
			hidden: true as const,
			...(resolved.selected ? { selected: resolved.selected } : {}),
			...(resolved.selectionSeed ? { selectionSeed: resolved.selectionSeed } : {}),
		};
	const result = await executeSearchFeatureFeedInput(
		resolved.featureInput,
		{
			sortProfile: "feed",
			pageBudget: "global",
			...(resolved.persistedSort
				? {
						persistedSort: {
							sort: resolved.persistedSort,
							behavior: "initial" as const,
						},
					}
				: {}),
		},
		resolved.localizationLanguages,
		input.profileId,
		input.hasDevelopmentPreviewAccess,
	);
	return presentSearchResultAsFeed(
		result,
		resolved.localizationLanguages,
		resolved.request.state,
		input.profileId,
	).then((response) => ({
		...response,
		...(resolved.selected ? { selected: resolved.selected } : {}),
		...(resolved.selectionSeed ? { selectionSeed: resolved.selectionSeed } : {}),
	}));
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
	const [tagMatches, tagPositionAvailability] = await Promise.all([
		getSearchTagMatchReasons({
			unitIds: items.map((item) => item.id),
			tagIds: result.searchTagIds,
			localizationLanguages,
		}),
		getTagPositionAvailability(items.flatMap((item) => (item.unitKind === "tag" ? [item.id] : []))),
	]);
	const presentedItems = items.map((item) => {
		const matches = tagMatches.get(item.id);
		const positionAvailability = tagPositionAvailability.get(item.id);
		return {
			...item,
			...(matches?.length ? { searchTagMatches: matches } : {}),
			...(positionAvailability
				? {
						tagHasOtherPositions: positionAvailability.hasOtherPositions,
						tagOtherPositionCount: positionAvailability.otherPositionCount,
					}
				: {}),
		};
	});
	const continuation = resolveFeedPageContinuation(items, result.nextCursor);
	return {
		items: presentedItems,
		...(continuation.status === "available" ? { nextCursor: continuation.cursor } : {}),
		facets: result.facets,
		total: result.total,
		...(result.advisory ? { advisory: result.advisory } : {}),
	};
}

export default new Elysia({ prefix: "/search" })
	.get(
		"/filter",
		{
			response: { [StatusCodes.OK]: SearchFeatureDefinitionResponse },
			detail: { summary: "Get the global Filter capability definition", tags: ["Search"] },
		},
		async ({ request }: { readonly request: Request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return resolveFilterDocument({}, hasDevelopmentPreviewAccess);
		},
	)
	.post(
		"/filter/definition",
		{
			body: FilterDocumentInput,
			response: {
				[StatusCodes.OK]: SearchFeatureDefinitionResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Resolve a Filter document", tags: ["Search"] },
		},
		async ({
			body,
			request,
		}: {
			readonly body: StaticDecode<typeof FilterDocumentInput>;
			readonly request: Request;
		}) => {
			const identity = await resolveIdentity(request, "unit:read");
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			return resolveFilterDocument(body, hasDevelopmentPreviewAccess);
		},
	)
	.post(
		"/filter/execute",
		{
			body: SearchFeatureExecutionBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a Filter document", tags: ["Search"] },
		},
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
	)
	.post(
		"/filter/feed",
		{
			body: SearchFeatureFeedPresentationBody,
			response: {
				[StatusCodes.OK]: SearchFeedResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Present a Filter document as a Feed", tags: ["Search"] },
		},
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
	)
	.get(
		"/zones/:zoneId/filter",
		{
			params: ZoneFilterParams,
			response: {
				[StatusCodes.OK]: SearchFeatureDefinitionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Get a Zone Filter definition", tags: ["Search", "Zones"] },
		},
		async ({
			params,
			request,
		}: {
			readonly params: StaticDecode<typeof ZoneFilterParams>;
			readonly request: Request;
		}) => {
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
	)
	.post(
		"/zones/:zoneId/filter/execute",
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
	)
	.post(
		"/zones/:zoneId/filter/feed",
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
	)
	.post(
		"/zones/:zoneId/dock/block-executions",
		{
			params: ZoneDockSearchParams,
			body: ZoneBlockExecutionBody,
			response: {
				[StatusCodes.OK]: ZoneSearchBlockExecutionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Dock Search Block", tags: ["Search"] },
		},
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
					zoneId: params.zoneId,
					blockPath: body.path,
					document: parseDocument(DockDocument, record.document),
					body,
					authorization: identity.authorization,
					resource: { kind: "dock", zoneId: params.zoneId, slot: "main" },
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
	)
	.post(
		"/zones/:zoneId/pages/:pageId/execute",
		{
			params: ZonePageAggregateExecutionParams,
			body: ZonePageAggregateExecutionBody,
			response: {
				[StatusCodes.OK]: ZonePageAggregateExecutionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
				[StatusCodes.CONFLICT]: UnitRevisionConflictResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: {
				summary: "Execute persisted query Blocks for a Zone Page surface",
				tags: ["Search", "Zones"],
				security: OptionalApiTokenOrSessionSecurity,
			},
		},
		async ({ params, body, request }) => {
			const identity = await resolveIdentityWithDynamicApiQuota(
				request,
				"unit:read",
				"search.execute",
				MaxZoneEagerBlockExecutions,
			);
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			const localizationLanguages = body.localizationLanguages ?? [];
			let surface;
			try {
				surface = await loadZonePageExecutionSurface({
					zoneId: params.zoneId,
					pageId: params.pageId,
					includeDock: body.includeDock ?? true,
					localizationLanguages,
				});
			} catch (cause) {
				await identity.admitApiQuota(0);
				if (cause instanceof TypeError) throw new InvalidSearch(cause.message);
				throw cause;
			}
			if (
				body.pageRevision !== undefined &&
				body.pageRevision !== surface.page.latestUnitRevisionId
			) {
				await identity.admitApiQuota(0);
				throw new UnitRevisionConflict(surface.page.latestUnitRevisionId);
			}

			let execution;
			try {
				execution = selectZonePageBlockExecutions(surface.plan, {
					page: body.pageBlocks,
					dock: body.dockBlocks,
				});
			} catch (cause) {
				await identity.admitApiQuota(0);
				throw cause;
			}
			await identity.admitApiQuota(execution.selected.length);
			const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
				DevelopmentPreviewCapability,
			);
			const profileId = identity.authorization.profileId;
			const results = await executeZonePageAggregate({
				surface,
				selected: execution.selected,
				skipped: execution.skipped,
				authorization: identity.authorization,
				localizationLanguages,
				executors: {
					executeSearch: ({
						descriptor,
						document,
						source,
						state,
						selectionSeed,
						localizationLanguages,
					}) =>
						executeZoneBlock({
							zoneId: params.zoneId,
							blockPath: descriptor.path,
							document,
							source,
							body: { state, selectionSeed, localizationLanguages },
							authorization: identity.authorization,
							resource:
								descriptor.surface === "page"
									? { kind: "page", pageId: params.pageId }
									: { kind: "dock", zoneId: params.zoneId, slot: "main" },
							execution: { sortProfile: "search", pageBudget: "per-category" },
							profileId,
							hasDevelopmentPreviewAccess,
						}),
					executeFeed: ({ descriptor, document, state, selectionSeed, localizationLanguages }) =>
						executeZoneFeedBlock({
							zoneId: params.zoneId,
							blockPath: descriptor.path,
							document,
							body: { state, selectionSeed, localizationLanguages },
							authorization: identity.authorization,
							resource:
								descriptor.surface === "page"
									? { kind: "page", pageId: params.pageId }
									: { kind: "dock", zoneId: params.zoneId, slot: "main" },
							profileId,
							hasDevelopmentPreviewAccess,
						}),
				},
			});
			return { pageRevision: surface.page.latestUnitRevisionId, ...results };
		},
	)
	.post(
		"/zones/:zoneId/pages/:pageId/block-executions",
		{
			params: ZonePageSearchParams,
			body: ZoneBlockExecutionBody,
			response: {
				[StatusCodes.OK]: ZoneSearchBlockExecutionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Page Search Block", tags: ["Search"] },
		},
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
					zoneId: params.zoneId,
					blockPath: body.path,
					document: record.document,
					body,
					authorization: identity.authorization,
					resource: { kind: "page", pageId: params.pageId },
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
	)
	.post(
		"/zones/:zoneId/dock/feed-block-executions",
		{
			params: ZoneDockSearchParams,
			body: ZoneBlockExecutionBody,
			response: {
				[StatusCodes.OK]: ZoneFeedBlockExecutionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Dock Feed Block", tags: ["Feed"] },
		},
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			try {
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
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				return await executeZoneFeedBlock({
					zoneId: params.zoneId,
					blockPath: body.path,
					document: parseDocument(DockDocument, record.document),
					body,
					authorization: identity.authorization,
					resource: { kind: "dock", zoneId: params.zoneId, slot: "main" },
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
					"Zone Dock Feed Block execution failed",
					"search.zone_dock_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
	)
	.post(
		"/zones/:zoneId/pages/:pageId/feed-block-executions",
		{
			params: ZonePageSearchParams,
			body: ZoneBlockExecutionBody,
			response: {
				[StatusCodes.OK]: ZoneFeedBlockExecutionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "ZonePageNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Execute a trusted Zone Page Feed Block", tags: ["Feed"] },
		},
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
			await identity.authorization.unit.ensureCanRead(
				params.zoneId,
				() => new UnitNotFound("Zone"),
			);
			try {
				const record = await database.transaction((tx) =>
					getZonePageUnitById(tx, params.zoneId, params.pageId),
				);
				if (!record) throw new ZonePageNotFound();
				const hasDevelopmentPreviewAccess = await identity.authorization.platform.hasCapability(
					DevelopmentPreviewCapability,
				);
				return await executeZoneFeedBlock({
					zoneId: params.zoneId,
					blockPath: body.path,
					document: record.document,
					body,
					authorization: identity.authorization,
					resource: { kind: "page", pageId: params.pageId },
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
					"Zone Page Feed Block execution failed",
					"search.zone_page_feed.failed",
					cause,
				);
				throw new SearchUnavailable(cause);
			}
		},
	)
	.post(
		"",
		{
			body: GroupedSearchBody,
			response: {
				[StatusCodes.OK]: SearchResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: SearchUnavailableResponse,
			},
			detail: { summary: "Search across public categories", tags: ["Search"] },
		},
		async ({ body, request }) => {
			try {
				const identity = await resolveIdentity(request, "unit:read", "search.execute");
				const indexes = body.indexes ?? [...SearchCategories];
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
	)
	.post(
		"/shared-queries",
		{
			body: SharedSearchQueryDocument,
			response: {
				[StatusCodes.CREATED]: SharedSearchQueryResponse,
				[StatusCodes.UNAUTHORIZED]: toApiErrorResponse(["AuthenticationRequired"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Create an immutable shared Search query", tags: ["Search"] },
		},
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
	)
	.get(
		"/shared-queries/:id",
		{
			params: SharedSearchQueryParams,
			response: {
				[StatusCodes.OK]: SharedSearchQueryResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["SharedSearchQueryNotFound"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: InvalidSearchResponse,
			},
			detail: { summary: "Get a shared Search query", tags: ["Search"] },
		},
		async ({ params }) => {
			const record = await getSharedSearchQuery(database, params.id);
			if (!record) throw new SharedSearchQueryNotFound();
			return presentSharedSearchQuery(record);
		},
	)
	.post(
		"/:index",
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
		async ({ params, body, request }) => {
			const identity = await resolveIdentity(request, "unit:read", "search.execute");
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
	);
