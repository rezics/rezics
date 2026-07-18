import {
	SearchCategoryValues,
	SearchSortValues,
	type SearchCategory,
	type SearchExpression,
	type SearchSort,
} from "@rezics/search";

export const SearchCategories = SearchCategoryValues;
export type { SearchCategory };
export const SearchSorts = SearchSortValues;
export type { SearchSort };

export interface SearchHit {
	id: string;
	kind: string;
	type: string;
	slug?: string | null;
	titles: string[];
	summaries: string[];
}

export interface DomainSearchRequest {
	/** Resolved server-side identity; never accepted from an API request body. */
	profileId?: string;
	query?: string;
	offset?: number;
	limit?: number;
	Languages?: string[];
	types?: string[];
	contentRatings?: string[];
	aiDisclosures?: string[];
	licenses?: string[];
	authorId?: string;
	realmId?: string;
	subjectId?: string;
	targetId?: string;
	rootId?: string;
	parentId?: string;
	ownerId?: string;
	joinPolicies?: string[];
	multiple?: boolean;
	resultsVisibilities?: string[];
	closed?: boolean;
	sort?: SearchSort;
	scopeUnitId?: string;
	includeScopeDescendants?: boolean;
	expression?: SearchExpression;
}

const CommonSortableAttributes = ["createdAt", "updatedAt"];
const CommonFilterableAttributes = [
	"Languages",
	"realmId",
	"tagId",
	"contentRating",
	"aiDisclosure",
	"license",
];

export const SearchCategoryRules = {
	units: {
		filterableAttributes: [...CommonFilterableAttributes, "type"],
		sortableAttributes: [...CommonSortableAttributes, "publishedAt"],
	},
	users: {
		filterableAttributes: CommonFilterableAttributes,
		sortableAttributes: [...CommonSortableAttributes, "subscriberCount"],
	},
	entity: {
		filterableAttributes: [...CommonFilterableAttributes, "type"],
		sortableAttributes: CommonSortableAttributes,
	},
	tags: {
		filterableAttributes: CommonFilterableAttributes,
		sortableAttributes: CommonSortableAttributes,
	},
	posts: {
		filterableAttributes: [
			"authorId",
			...CommonFilterableAttributes,
			"subjectId",
			"rootId",
			"parentId",
		],
		sortableAttributes: [...CommonSortableAttributes, "replyCount"],
	},
	realms: {
		filterableAttributes: [...CommonFilterableAttributes, "joinPolicy"],
		sortableAttributes: [...CommonSortableAttributes, "subscriberCount"],
	},
	collections: {
		filterableAttributes: [...CommonFilterableAttributes, "ownerId"],
		sortableAttributes: CommonSortableAttributes,
	},
	reviews: {
		filterableAttributes: [...CommonFilterableAttributes, "authorId", "targetId", "type"],
		sortableAttributes: CommonSortableAttributes,
	},
	polls: {
		filterableAttributes: [
			...CommonFilterableAttributes,
			"multiple",
			"resultsVisibility",
			"closesAt",
		],
		sortableAttributes: [...CommonSortableAttributes, "closesAt"],
	},
};
