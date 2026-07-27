import {
	SearchCategoryValues,
	SearchSortValues,
	type SearchCategory,
	type SearchScalarField,
	type SearchSort,
} from "@rezics/filter";
import type { UnitPredicate } from "@rezics/filter";
import type { PresentedAvatar } from "@rezics/avatar";
import type { ContentLanguage } from "@rezics/i18n";
import type { PublicationLicenseId } from "@rezics/license";
import type { PublicSlugAddressValue } from "@rezics/slug";

import type { SearchExpression } from "./query";

export const SearchCategories = SearchCategoryValues;
export type { SearchCategory };
export const SearchSorts = SearchSortValues;
export type { SearchSort };

export interface SearchHit {
	id: string;
	slugAddress: PublicSlugAddressValue | null;
	category: string;
	kind: string;
	titles: string[];
	summaries: string[];
	avatar?: PresentedAvatar | null;
	variantRole?: "standalone" | "main" | "variant";
	variantMain?:
		| { readonly state: "unavailable" }
		| {
				readonly state: "available";
				readonly unit: {
					readonly id: string;
					readonly type: "book" | "software" | "media";
					readonly title: string | null;
					readonly cover: { readonly id: string; readonly url: string } | null;
				};
		  };
}

export interface DomainSearchRequest {
	/** Resolved server-side identity; never accepted from an API request body. */
	profileId?: string;
	query?: string;
	offset?: number;
	cursor?: string;
	limit?: number;
	Languages?: ContentLanguage[];
	kinds?: string[];
	contentRatings?: string[];
	aiDisclosures?: string[];
	licenses?: PublicationLicenseId[];
	contentLicensed?: boolean;
	creditedUnitId?: string;
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
	searchExpression?: SearchExpression;
	domainFilter?: UnitPredicate;
}

const CommonSortableAttributes = ["createdAt", "updatedAt"] as const;
const CommonFilterableAttributes = [
	"Languages",
	"realmId",
	"tagId",
	"contentRating",
	"aiDisclosure",
	"license",
] as const;

export const SearchFieldByFilterableAttribute = {
	Languages: "language",
	kind: "kind",
	contentRating: "content-rating",
	aiDisclosure: "ai-disclosure",
	license: "license",
	contentLicensed: "catalog-licensed",
	creditedUnitId: "credit",
	realmId: "realm",
	tagId: "tag",
	subjectId: "subject",
	targetId: "target",
	rootId: "root",
	parentId: "parent",
	ownerId: "owner",
	joinPolicy: "join-policy",
	multiple: "multiple",
	resultsVisibility: "results-visibility",
	closesAt: "closed",
} as const satisfies Record<string, SearchScalarField>;

export type SearchFilterableAttribute = keyof typeof SearchFieldByFilterableAttribute;

export const SearchCategoryRules = {
	units: {
		filterableAttributes: [...CommonFilterableAttributes, "kind", "contentLicensed"],
		sortableAttributes: [...CommonSortableAttributes, "publishedAt"],
	},
	users: {
		filterableAttributes: CommonFilterableAttributes,
		sortableAttributes: [...CommonSortableAttributes, "followerCount"],
	},
	entity: {
		filterableAttributes: [...CommonFilterableAttributes, "kind", "ownerId"],
		sortableAttributes: CommonSortableAttributes,
	},
	tags: {
		filterableAttributes: CommonFilterableAttributes,
		sortableAttributes: CommonSortableAttributes,
	},
	"tag-structures": {
		filterableAttributes: [],
		sortableAttributes: CommonSortableAttributes,
	},
	posts: {
		filterableAttributes: [
			"creditedUnitId",
			...CommonFilterableAttributes,
			"kind",
			"subjectId",
			"rootId",
			"parentId",
		],
		sortableAttributes: [...CommonSortableAttributes, "replyCount"],
	},
	realms: {
		filterableAttributes: [...CommonFilterableAttributes, "joinPolicy"],
		sortableAttributes: [...CommonSortableAttributes, "followerCount"],
	},
	collections: {
		filterableAttributes: [...CommonFilterableAttributes, "ownerId"],
		sortableAttributes: CommonSortableAttributes,
	},
	reviews: {
		filterableAttributes: [...CommonFilterableAttributes, "creditedUnitId", "targetId", "kind"],
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
} as const satisfies Record<
	SearchCategory,
	{
		readonly filterableAttributes: readonly SearchFilterableAttribute[];
		readonly sortableAttributes: readonly string[];
	}
>;
