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
import type { LicenseId } from "@rezics/license";
import type { PublicSlugAddressValue } from "@rezics/slug";

import type { ContentRatingPolicy } from "../content-rating/policy";
import type { SearchExpression } from "./query";
import type { SearchKeysetPosition } from "./query";

export const SearchCategories = SearchCategoryValues;
export type { SearchCategory };
export const SearchSorts = SearchSortValues;
export type { SearchSort };

export interface SearchHit {
	id: string;
	slugAddress: PublicSlugAddressValue | null;
	category: string;
	kind: string;
	language: ContentLanguage;
	title: string | null;
	summary: string | null;
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
					readonly language: ContentLanguage;
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
	localizationLanguages?: readonly ContentLanguage[];
	Languages?: ContentLanguage[];
	kinds?: string[];
	contentRatings?: string[];
	aiDisclosures?: string[];
	licenses?: LicenseId[];
	creditedUnitId?: string;
	realmId?: string;
	realmTagContextRealmId?: string;
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
	/** Server-owned keyset state; never accepted directly from an API body. */
	searchPosition?: SearchKeysetPosition;
	/** Server-owned number of prior results represented by the keyset. */
	searchSeen?: number;
	/** Server-owned effective content-rating policy; never accepted directly from an API body. */
	contentRatingPolicy?: ContentRatingPolicy;
}

export const SearchFieldByDomainRequestFilter = {
	Languages: "language",
	kind: "kind",
	contentRating: "content-rating",
	aiDisclosure: "ai-disclosure",
	license: "license",
	creditedUnitId: "credit",
	realmId: "realm",
	realmTagContextRealmId: "realm-tag-context",
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
