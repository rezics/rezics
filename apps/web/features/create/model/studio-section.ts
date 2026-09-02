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
export const StudioTagPathCreateHref = "/create/tag/path/new";

export const StudioSectionCreateHrefs = {
	book: "/create/book/new",
	software: "/create/software/new",
	media: "/create/media/new",
	entity: "/create/entity/new",
	tag: StudioTagCreateHref,
	realm: "/create/realm/new",
	zone: "/create/zone/new",
	post: "/create/post/new",
	wiki: "/create/wiki/new",
	collection: "/create/collection/new",
	review: "/create/review/new",
	poll: "/create/poll/new",
} as const satisfies Record<StudioSectionId, string>;

export type StudioCreateSearchParams = Readonly<
	Record<string, string | readonly string[] | undefined>
>;

export function studioSectionCreateHref(
	sectionId: StudioSectionId,
	searchParams?: StudioCreateSearchParams,
): string {
	const href = StudioSectionCreateHrefs[sectionId];
	if (!searchParams) return href;
	const query = new URLSearchParams();
	for (const [key, rawValue] of Object.entries(searchParams)) {
		if (typeof rawValue === "string") query.append(key, rawValue);
		else if (rawValue) for (const value of rawValue) query.append(key, value);
	}
	const value = query.toString();
	return value ? `${href}?${value}` : href;
}

export const StudioGenericCreateSectionIds = StudioSectionIds.filter(
	(sectionId): sectionId is Exclude<StudioSectionId, "tag"> => sectionId !== "tag",
);
export type StudioGenericCreateSectionId = (typeof StudioGenericCreateSectionIds)[number];

export function isStudioGenericCreateSectionId(
	value: string,
): value is StudioGenericCreateSectionId {
	return StudioGenericCreateSectionIds.some((sectionId) => sectionId === value);
}

export const StudioCreationLifecycleIds = [
	"configurable",
	"publish_now",
	"private_first",
	"immutable",
	"preview",
] as const;
export type StudioCreationLifecycleId = (typeof StudioCreationLifecycleIds)[number];

const StudioSectionCreationLifecycles = {
	book: "configurable",
	software: "configurable",
	media: "configurable",
	entity: "configurable",
	tag: "publish_now",
	realm: "publish_now",
	zone: "preview",
	post: "publish_now",
	wiki: "publish_now",
	collection: "private_first",
	review: "publish_now",
	poll: "publish_now",
} as const satisfies Record<StudioSectionId, StudioCreationLifecycleId>;

export type StudioCreateAction =
	| {
			readonly kind: "section";
			readonly href: string;
			readonly lifecycle: StudioCreationLifecycleId;
	  }
	| {
			readonly kind: "tag_path";
			readonly href: typeof StudioTagPathCreateHref;
			readonly lifecycle: "immutable";
	  };

export function studioSectionCreateActions(
	sectionId: StudioSectionId,
): readonly StudioCreateAction[] {
	const sectionAction = {
		kind: "section",
		href: studioSectionCreateHref(sectionId),
		lifecycle: StudioSectionCreationLifecycles[sectionId],
	} as const satisfies StudioCreateAction;
	return sectionId === "tag"
		? [sectionAction, { kind: "tag_path", href: StudioTagPathCreateHref, lifecycle: "immutable" }]
		: [sectionAction];
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
