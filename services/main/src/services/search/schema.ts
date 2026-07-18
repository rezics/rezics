export const SearchCategories = [
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

export type SearchCategory = (typeof SearchCategories)[number];

export const SearchSorts = [
	"relevance",
	"createdAt:asc",
	"createdAt:desc",
	"updatedAt:asc",
	"updatedAt:desc",
	"publishedAt:asc",
	"publishedAt:desc",
	"subscriberCount:asc",
	"subscriberCount:desc",
	"replyCount:asc",
	"replyCount:desc",
	"closesAt:asc",
	"closesAt:desc",
] as const;

export type SearchSort = (typeof SearchSorts)[number];

export interface SearchHit {
	id: string;
	kind: string;
	type: string;
	slug?: string | null;
	titles: string[];
	summaries: string[];
}

export interface DomainSearchRequest {
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
}

const CommonSortableAttributes = ["createdAt", "updatedAt"];

export const SearchCategoryRules = {
	units: {
		filterableAttributes: ["type", "Languages", "contentRating", "aiDisclosure", "license"],
		sortableAttributes: [...CommonSortableAttributes, "publishedAt"],
	},
	users: {
		filterableAttributes: ["Languages"],
		sortableAttributes: [...CommonSortableAttributes, "subscriberCount"],
	},
	entity: {
		filterableAttributes: ["type", "Languages"],
		sortableAttributes: CommonSortableAttributes,
	},
	tags: {
		filterableAttributes: ["Languages"],
		sortableAttributes: CommonSortableAttributes,
	},
	posts: {
		filterableAttributes: [
			"authorId",
			"realmId",
			"subjectId",
			"rootId",
			"parentId",
			"Languages",
		],
		sortableAttributes: [...CommonSortableAttributes, "replyCount"],
	},
	realms: {
		filterableAttributes: ["joinPolicy", "Languages"],
		sortableAttributes: [...CommonSortableAttributes, "subscriberCount"],
	},
	collections: {
		filterableAttributes: ["ownerId", "Languages"],
		sortableAttributes: CommonSortableAttributes,
	},
	reviews: {
		filterableAttributes: ["authorId", "targetId", "realmId", "type", "Languages"],
		sortableAttributes: CommonSortableAttributes,
	},
	polls: {
		filterableAttributes: ["multiple", "resultsVisibility", "closesAt", "Languages"],
		sortableAttributes: [...CommonSortableAttributes, "closesAt"],
	},
};
