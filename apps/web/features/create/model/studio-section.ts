import type { ListCurrentUserStudioContentSection } from "@rezics/openapi-tanstack-query";

import {
	publicUnitHref,
	type PublicUnitRouteValue,
} from "@/features/units/routing/public-unit-route";

export const StudioSectionIds = [
	"post",
	"book",
	"software",
	"media",
	"entity",
	"tag",
	"realm",
	"zone",
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

export const StudioTagCreateHref = "/create/tag/new";

export const StudioSectionCreateHrefs = {
	book: "/units/book/new",
	software: "/units/software/new",
	media: "/units/media/new",
	entity: "/entities/new",
	tag: StudioTagCreateHref,
	realm: "/realms/new",
	zone: "/zones/new",
	post: "/posts/new",
	wiki: "/wiki/new",
	collection: "/collections/new",
	review: "/reviews/new",
	poll: "/polls/new",
} as const satisfies Partial<Record<StudioSectionId, string>>;

export function studioSectionCreateHref(sectionId: StudioSectionId): string | undefined {
	return StudioSectionCreateHrefs[sectionId];
}

const StudioPublicUnitKinds = {
	book: "book",
	software: "software",
	media: "media",
	entity: "entity",
	tag: "tag",
	realm: "realm",
	zone: "zone",
	post: "post",
	wiki: "post",
	collection: "collection",
	review: "post",
	poll: "poll",
} as const satisfies Record<StudioSectionId, string>;

export function studioContentHref(
	sectionId: StudioSectionId,
	resource: PublicUnitRouteValue,
): string {
	const href = publicUnitHref(StudioPublicUnitKinds[sectionId], resource);
	if (!href) throw new Error("Unsupported Studio section");
	return href;
}
