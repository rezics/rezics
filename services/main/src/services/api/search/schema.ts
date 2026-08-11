import { type Static, t } from "elysia";
import { SearchContinuationToken } from "@rezics/filter";
import { PublicationLicenseIds } from "@rezics/license";

import { SearchCategories, SearchSorts } from "../../search/schema";
import { ContentRatingValues } from "../../database/schema/contract-values";
import { ContentLanguage, LocalizationLanguageHints, Uuid } from "../schema";

const SearchCategory = t.Union(SearchCategories.map((category) => t.Literal(category)));

const SearchSort = t.Union(SearchSorts.map((sort) => t.Literal(sort)));

const SearchStringList = t.Array(t.String({ minLength: 1 }), { maxItems: 50 });
const SearchLanguageList = t.Array(ContentLanguage, { maxItems: 50 });
const SearchLicenseList = t.Array(t.UnionEnum(PublicationLicenseIds), { maxItems: 50 });
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
		contentLicenseActive: t.Optional(t.Boolean()),
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
export type DomainSearchBody = Static<typeof DomainSearchBody>;

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
export type GroupedSearchBody = Static<typeof GroupedSearchBody>;

export const DomainSearchParams = t.Object({ index: SearchCategory });
export type DomainSearchParams = Static<typeof DomainSearchParams>;
