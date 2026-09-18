import type { UnitOwner } from "@rezics/reference";
import type { ContentRating } from "@rezics/schema/postgres/shared/contract-values";
export const PublicUnitSeoOwners = [
	"publishing",
	"music",
	"program",
	"software",
	"entity",
	"grouping",
	"reference",
	"distribution",
	"video",
	"audio",
	"post",
	"poll",
	"zone",
	"realm",
	"collection",
	"tag",
] as const satisfies readonly UnitOwner[];
export type PublicUnitSeoOwner = (typeof PublicUnitSeoOwners)[number];
const PublicUnitSeoOwnerSet = new Set<string>(PublicUnitSeoOwners);
const SeoContentRatings = new Set<ContentRating>(["general", "r15"]);
export function isPublicUnitSeoOwner(owner: string): owner is PublicUnitSeoOwner {
	return PublicUnitSeoOwnerSet.has(owner);
}

export function isSeoContentRating(contentRating: ContentRating): boolean {
	return SeoContentRatings.has(contentRating);
}

export type PublicUnitSeoIndexing =
	| { readonly state: "index" }
	| {
			readonly state: "noindex";
			readonly reason: "adult" | "unlisted" | "incomplete";
	  };

export function classifyPublicUnitSeoIndexing(input: {
	readonly contentRating: ContentRating;
	readonly visibility: "public" | "unlisted";
	readonly hasPresentation: boolean;
}): PublicUnitSeoIndexing {
	if (!isSeoContentRating(input.contentRating)) return { state: "noindex", reason: "adult" };
	if (!input.hasPresentation) return { state: "noindex", reason: "incomplete" };
	return input.visibility === "public"
		? { state: "index" }
		: { state: "noindex", reason: "unlisted" };
}
