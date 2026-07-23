import { type Static, Type } from "@sinclair/typebox";

export const SearchUuid = Type.String({
	pattern:
		"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
});

export const SearchControlKey = Type.String({
	minLength: 1,
	maxLength: 64,
	pattern: "^[a-z][a-z0-9-]*$",
});

function stringEnum<const Values extends readonly [string, ...string[]]>(values: Values) {
	return Type.Enum(
		Object.fromEntries(values.map((value) => [value, value])) as {
			[Value in Values[number]]: Value;
		},
	);
}

export const SearchCategoryValues = [
	"units",
	"users",
	"entity",
	"tags",
	"posts",
	"realms",
	"collections",
	"reviews",
	"polls",
] as const;
export type SearchCategory = (typeof SearchCategoryValues)[number];
export const SearchCategory = stringEnum(SearchCategoryValues);

export const SearchModeValues = ["basic", "advanced"] as const;
export type SearchMode = (typeof SearchModeValues)[number];
export const SearchMode = stringEnum(SearchModeValues);

export const SearchSortValues = [
	"relevance",
	"createdAt:asc",
	"createdAt:desc",
	"updatedAt:asc",
	"updatedAt:desc",
	"publishedAt:asc",
	"publishedAt:desc",
	"followerCount:asc",
	"followerCount:desc",
	"replyCount:asc",
	"replyCount:desc",
	"closesAt:asc",
	"closesAt:desc",
] as const;
export type SearchSort = (typeof SearchSortValues)[number];
export const SearchSort = stringEnum(SearchSortValues);

/** Engine-independent fields that a product surface may expose. */
export const SearchFieldValues = [
	"category",
	"kind",
	"language",
	"content-rating",
	"ai-disclosure",
	"license",
	"tag",
	"credit",
	"realm",
	"zone",
	"subject",
	"target",
	"root",
	"parent",
	"owner",
	"join-policy",
	"multiple",
	"results-visibility",
	"closed",
	"created-at",
	"updated-at",
	"published-at",
	"closes-at",
	"catalog-licensed",
	"catalog-release-date",
	"book-isbn13",
	"book-publication-date",
	"book-page-count",
	"book-word-count",
	"book-format",
	"media-kind",
	"media-release-date",
	"media-runtime-minutes",
	"media-episode-count",
	"media-season-count",
	"software-release-date",
	"software-version-label",
	"software-platform",
	"software-requirement-tier",
] as const;
export type SearchField = (typeof SearchFieldValues)[number];
export const SearchField = stringEnum(SearchFieldValues);

export const SearchOperatorValues = [
	"equals",
	"not-equals",
	"any-of",
	"all-of",
	"none-of",
	"range",
	"exists",
] as const;
export type SearchOperator = (typeof SearchOperatorValues)[number];
export const SearchOperator = stringEnum(SearchOperatorValues);

export const SearchScalar = Type.Union([
	Type.String({ minLength: 1, maxLength: 500 }),
	Type.Number(),
	Type.Boolean(),
]);
export type SearchScalar = Static<typeof SearchScalar>;

export const SearchFilter = Type.Union(
	[
		Type.Object(
			{ field: SearchField, operator: Type.Literal("equals"), value: SearchScalar },
			{ additionalProperties: false },
		),
		Type.Object(
			{ field: SearchField, operator: Type.Literal("not-equals"), value: SearchScalar },
			{ additionalProperties: false },
		),
		Type.Object(
			{
				field: SearchField,
				operator: Type.Union([
					Type.Literal("any-of"),
					Type.Literal("all-of"),
					Type.Literal("none-of"),
				]),
				values: Type.Array(SearchScalar, { minItems: 1, maxItems: 50 }),
			},
			{ additionalProperties: false },
		),
		Type.Union([
			Type.Object(
				{
					field: SearchField,
					operator: Type.Literal("range"),
					lower: SearchScalar,
					upper: Type.Optional(SearchScalar),
				},
				{ additionalProperties: false },
			),
			Type.Object(
				{
					field: SearchField,
					operator: Type.Literal("range"),
					lower: Type.Optional(SearchScalar),
					upper: SearchScalar,
				},
				{ additionalProperties: false },
			),
		]),
		Type.Object(
			{ field: SearchField, operator: Type.Literal("exists"), value: Type.Boolean() },
			{ additionalProperties: false },
		),
	],
	{ $id: "SearchFilter" },
);
export type SearchFilter = Static<typeof SearchFilter>;

export const SearchScope = Type.Union(
	[
		Type.Object({ kind: Type.Literal("global") }, { additionalProperties: false }),
		Type.Object(
			{
				kind: Type.Literal("unit"),
				unitId: SearchUuid,
				includeDescendants: Type.Boolean({ default: false }),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{ kind: Type.Literal("realm"), realmId: SearchUuid },
			{ additionalProperties: false },
		),
		Type.Object(
			{ kind: Type.Literal("zone"), zoneId: SearchUuid },
			{ additionalProperties: false },
		),
	],
	{ $id: "SearchScope" },
);
export type SearchScope = Static<typeof SearchScope>;

const SearchStaticOption = Type.Object(
	{
		value: SearchScalar,
		/** Localized option copy belongs to a Unit, never to this configuration. */
		labelUnitId: Type.Optional(SearchUuid),
	},
	{ additionalProperties: false },
);

export const SearchOptionSource = Type.Union([
	Type.Object({ kind: Type.Literal("facet") }, { additionalProperties: false }),
	Type.Object(
		{
			kind: Type.Literal("static"),
			options: Type.Array(SearchStaticOption, { minItems: 1, maxItems: 100 }),
		},
		{ additionalProperties: false },
	),
]);
export type SearchOptionSource = Static<typeof SearchOptionSource>;

export const SearchOptionPolicy = Type.Union([
	Type.Object({ kind: Type.Literal("all") }, { additionalProperties: false }),
	Type.Object(
		{
			kind: Type.Literal("include"),
			values: Type.Array(SearchScalar, { minItems: 1, maxItems: 100 }),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("exclude"),
			values: Type.Array(SearchScalar, { minItems: 1, maxItems: 100 }),
		},
		{ additionalProperties: false },
	),
]);
export type SearchOptionPolicy = Static<typeof SearchOptionPolicy>;

export const SearchControl = Type.Object(
	{
		key: SearchControlKey,
		field: SearchField,
		component: Type.Union([
			Type.Literal("select"),
			Type.Literal("multi-select"),
			Type.Literal("toggle"),
			Type.Literal("date-range"),
			Type.Literal("value-range"),
		]),
		modes: Type.Array(SearchMode, { minItems: 1, maxItems: 2 }),
		operators: Type.Array(SearchOperator, { minItems: 1, maxItems: 7 }),
		optionSource: Type.Optional(SearchOptionSource),
		optionPolicy: Type.Optional(SearchOptionPolicy),
		labelUnitId: Type.Optional(SearchUuid),
		required: Type.Optional(Type.Boolean({ default: false })),
	},
	{ additionalProperties: false, $id: "SearchControl" },
);
export type SearchControl = Static<typeof SearchControl>;
