import type { StaticDecode } from "typebox";
import {
	BlockPath,
	MaxDockQueryBlocks,
	MaxZoneEagerBlockExecutions,
	MaxZonePageQueryBlocks,
} from "@rezics/block";
import { t } from "elysia";
import { SearchContinuationToken, SearchFeatureState } from "@rezics/filter";
import { LicenseIds } from "@rezics/license";

import { SearchCategories, SearchSorts } from "../../search/schema";
import { ContentRatingValues } from "../../database/schema/contract-values";
import { SearchCountResultSchema } from "../../counts/contract";
import { ContentLanguage, LocalizationLanguageHints, Uuid } from "../schema";
import {
	FeedPostItemResponse,
	FeedUnitItemResponse,
	SearchFeedResponse,
	SearchHit,
	SearchResponse,
	UnitPresentationResponse,
} from "../schema/response";

const SearchCategory = t.Union(SearchCategories.map((category) => t.Literal(category)));

const SearchSort = t.Union(SearchSorts.map((sort) => t.Literal(sort)));

const SearchStringList = t.Array(t.String({ minLength: 1 }), { maxItems: 50 });
const SearchLanguageList = t.Array(ContentLanguage, { maxItems: 50 });
const SearchLicenseList = t.Array(t.UnionEnum(LicenseIds), { maxItems: 50 });
const SearchContentRatingList = t.Array(t.UnionEnum(ContentRatingValues), {
	maxItems: ContentRatingValues.length,
	uniqueItems: true,
});

export const DomainSearchBody = t.Object(
	{
		query: t.Optional(t.String({ maxLength: 500, default: "" })),
		cursor: t.Optional(SearchContinuationToken),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
		localizationLanguages: t.Optional(LocalizationLanguageHints),
		Languages: t.Optional(SearchLanguageList),
		kinds: t.Optional(SearchStringList),
		contentRatings: t.Optional(SearchContentRatingList),
		aiDisclosures: t.Optional(SearchStringList),
		licenses: t.Optional(SearchLicenseList),
		creditedUnitId: t.Optional(t.String({ minLength: 1 })),
		realmId: t.Optional(t.String({ minLength: 1 })),
		realmTagContextRealmId: t.Optional(Uuid),
		subjectId: t.Optional(t.String({ minLength: 1 })),
		targetId: t.Optional(t.String({ minLength: 1 })),
		rootId: t.Optional(t.String({ minLength: 1 })),
		parentId: t.Optional(t.String({ minLength: 1 })),
		ownerId: t.Optional(t.String({ minLength: 1 })),
		joinPolicies: t.Optional(SearchStringList),
		multiple: t.Optional(t.Boolean()),
		resultsVisibilities: t.Optional(SearchStringList),
		closed: t.Optional(t.Boolean()),
		sort: t.Optional(SearchSort),
	},
	{ additionalProperties: false },
);
export type DomainSearchBody = StaticDecode<typeof DomainSearchBody>;

export const GroupedSearchBody = t.Object(
	{
		query: t.Optional(t.String({ maxLength: 500, default: "" })),
		indexes: t.Optional(t.Array(SearchCategory, { minItems: 1, maxItems: 10 })),
		localizationLanguages: t.Optional(LocalizationLanguageHints),
		Languages: t.Optional(SearchLanguageList),
		limitPerIndex: t.Optional(t.Integer({ minimum: 1, maximum: 20, default: 5 })),
	},
	{ additionalProperties: false },
);
export type GroupedSearchBody = StaticDecode<typeof GroupedSearchBody>;

export const DomainSearchParams = t.Object({ index: SearchCategory });
export type DomainSearchParams = StaticDecode<typeof DomainSearchParams>;

export const ZonePageAggregateExecutionParams = t.Object(
	{ zoneId: Uuid, pageId: Uuid },
	{ additionalProperties: false },
);

export const ZoneDerivedSelectionSeed = t.String({ minLength: 1, maxLength: 128 });

export const ZonePageAggregateBlockRequest = t.Object(
	{
		path: BlockPath,
		selectionSeed: t.Optional(ZoneDerivedSelectionSeed),
		state: t.Optional(SearchFeatureState),
	},
	{ additionalProperties: false },
);

export const ZonePageAggregateExecutionBody = t.Object(
	{
		pageRevision: t.Optional(Uuid),
		includeDock: t.Optional(t.Boolean({ default: true })),
		pageBlocks: t.Optional(
			t.Array(ZonePageAggregateBlockRequest, {
				minItems: 1,
				maxItems: MaxZoneEagerBlockExecutions,
			}),
		),
		dockBlocks: t.Optional(
			t.Array(ZonePageAggregateBlockRequest, {
				minItems: 1,
				maxItems: MaxZoneEagerBlockExecutions,
			}),
		),
		localizationLanguages: t.Optional(LocalizationLanguageHints),
	},
	{ additionalProperties: false },
);

export const ZonePageAggregateExecutionErrorCodeValues = [
	"InvalidSearch",
	"SearchTimeout",
	"SearchUnavailable",
	"CollectionNotFound",
	"UnitNotFound",
] as const;

const ZonePageAggregateFacetResponse = SearchResponse.properties.facets;
const FeedItemResponse = t.Union([FeedUnitItemResponse, FeedPostItemResponse]);
const AggregateResultBase = {
	kind: t.Literal("ok"),
	nextCursor: t.Optional(SearchContinuationToken),
	advisory: SearchResponse.properties.advisory,
	facets: ZonePageAggregateFacetResponse,
	total: t.Optional(SearchCountResultSchema),
	selected: t.Optional(UnitPresentationResponse),
	selectionSeed: t.Optional(ZoneDerivedSelectionSeed),
} as const;

export const ZonePageAggregateExecutionResult = t.Union([
	t.Object(
		{
			...AggregateResultBase,
			blockType: t.Literal("unit-list"),
			itemKind: t.Literal("search-hit"),
			items: t.Array(SearchHit, { maxItems: 20 }),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...AggregateResultBase,
			blockType: t.Literal("unit-list"),
			itemKind: t.Literal("feed-item"),
			items: t.Array(FeedItemResponse, { maxItems: 20 }),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			...AggregateResultBase,
			blockType: t.Literal("feed"),
			itemKind: t.Literal("feed-item"),
			items: t.Array(FeedItemResponse, { maxItems: 20 }),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("error"),
			code: t.UnionEnum(ZonePageAggregateExecutionErrorCodeValues),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("skipped"),
			reason: t.Union([t.Literal("budget"), t.Literal("inactive-tab")]),
		},
		{ additionalProperties: false },
	),
	t.Object({ kind: t.Literal("hidden") }, { additionalProperties: false }),
]);

const ZoneDerivedExecutionMetadata = {
	hidden: t.Optional(t.Boolean()),
	selected: t.Optional(UnitPresentationResponse),
	selectionSeed: t.Optional(ZoneDerivedSelectionSeed),
} as const;

export const ZoneSearchBlockExecutionResponse = t.Object(
	{
		...SearchResponse.properties,
		...ZoneDerivedExecutionMetadata,
	},
	{ additionalProperties: false },
);

export const ZoneFeedBlockExecutionResponse = t.Object(
	{
		...SearchFeedResponse.properties,
		...ZoneDerivedExecutionMetadata,
	},
	{ additionalProperties: false },
);

const ZonePageAggregateExecutionEntry = t.Object(
	{
		path: BlockPath,
		outcome: ZonePageAggregateExecutionResult,
	},
	{ additionalProperties: false },
);

const ZonePageAggregatePageResponse = t.Object(
	{
		results: t.Array(ZonePageAggregateExecutionEntry, {
			maxItems: MaxZonePageQueryBlocks,
		}),
	},
	{ additionalProperties: false },
);

const ZonePageAggregateDockResponse = t.Object(
	{
		results: t.Array(ZonePageAggregateExecutionEntry, {
			maxItems: MaxDockQueryBlocks,
		}),
	},
	{ additionalProperties: false },
);

export const ZonePageAggregateExecutionResponse = t.Object(
	{
		pageRevision: Uuid,
		page: ZonePageAggregatePageResponse,
		dock: t.Optional(ZonePageAggregateDockResponse),
	},
	{ additionalProperties: false },
);

export type ZonePageAggregateExecutionBody = StaticDecode<typeof ZonePageAggregateExecutionBody>;
export type ZonePageAggregateExecutionResult = StaticDecode<
	typeof ZonePageAggregateExecutionResult
>;
export type ZonePageAggregateExecutionEntry = StaticDecode<typeof ZonePageAggregateExecutionEntry>;
