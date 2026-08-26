import type { ContentRating, UnitKind } from "../database/schema/contract-values";

export const PublicUnitSeoKinds = [
	"profile",
	"book",
	"software",
	"release",
	"media",
	"video",
	"audio",
	"entity",
	"tag",
	"series",
	"zone",
	"zone_page",
	"collection",
	"post",
	"poll",
	"realm",
] as const satisfies readonly UnitKind[];

export type PublicUnitSeoKind = (typeof PublicUnitSeoKinds)[number];

const PublicUnitSeoKindSet = new Set<UnitKind>(PublicUnitSeoKinds);
const SeoContentRatings = new Set<ContentRating>(["general", "r15"]);

export function isPublicUnitSeoKind(kind: UnitKind): kind is PublicUnitSeoKind {
	return PublicUnitSeoKindSet.has(kind);
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
