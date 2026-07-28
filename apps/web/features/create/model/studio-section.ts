import type { ListCurrentUserStudioContentSection } from "@rezics/openapi-tanstack-query";

export const StudioSectionIds = [
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"realm",
	"zone",
	"post",
	"wiki",
	"collection",
	"review",
	"poll",
] as const satisfies readonly ListCurrentUserStudioContentSection[];

export type StudioSectionId = (typeof StudioSectionIds)[number];
type StudioSectionContractIsExact =
	Exclude<ListCurrentUserStudioContentSection, StudioSectionId> extends never ? true : false;
export const StudioSectionContractIsExact: StudioSectionContractIsExact = true;

export function isStudioSectionId(value: string): value is StudioSectionId {
	return StudioSectionIds.some((sectionId) => sectionId === value);
}

export const StudioSectionCreateHrefs = {
	book: "/units/book/new",
	software: "/units/software/new",
	media: "/units/media/new",
	entity: "/entities/new",
	tag: "/tags/new",
	realm: "/realms/new",
	zone: "/zones/new",
	post: "/posts/new",
	collection: "/collections/new",
	review: "/reviews/new",
	poll: "/polls/new",
} as const satisfies Partial<Record<StudioSectionId, string>>;

export function studioSectionCreateHref(sectionId: StudioSectionId): string | undefined {
	if (sectionId === "wiki") return undefined;
	return StudioSectionCreateHrefs[sectionId];
}

export function studioContentHref(sectionId: StudioSectionId, unitId: string): string {
	switch (sectionId) {
		case "book":
		case "software":
		case "media":
			return `/units/${sectionId}/${unitId}`;
		case "entity":
			return `/entities/${unitId}`;
		case "tag":
			return `/tags/${unitId}`;
		case "realm":
			return `/realm/${unitId}`;
		case "zone":
			return `/zone/${unitId}`;
		case "post":
		case "wiki":
		case "review":
			return `/posts/${unitId}`;
		case "collection":
			return `/collections/${unitId}`;
		case "poll":
			return `/polls/${unitId}`;
		default:
			sectionId satisfies never;
			throw new Error("Unsupported Studio section");
	}
}
