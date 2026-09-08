import { CatalogOwnerValues, type UnitOwner } from "@rezics/reference";
import type { ListCurrentUserStudioContentSection } from "@rezics/openapi-tanstack-query";

import {
	publicUnitHref,
	type PublicUnitRouteValue,
} from "@/features/units/routing/public-unit-route";

export const StudioSectionIds = [
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
	"wiki",
	"review",
	"poll",
	"realm",
	"zone",
	"collection",
	"tag",
] as const satisfies readonly ListCurrentUserStudioContentSection[];

export type StudioSectionId = (typeof StudioSectionIds)[number];
type StudioSectionContractIsExact =
	Exclude<ListCurrentUserStudioContentSection, StudioSectionId> extends never ? true : false;
export const StudioSectionContractIsExact: StudioSectionContractIsExact = true;

export function isStudioSectionId(value: string): value is StudioSectionId {
	return StudioSectionIds.some((sectionId) => sectionId === value);
}

export const StudioSectionGroups = [
	{
		id: "catalog",
		sectionIds: [
			"publishing",
			"music",
			"program",
			"software",
			"entity",
			"grouping",
			"reference",
			"distribution",
		],
	},
	{ id: "content", sectionIds: ["post", "wiki", "review", "poll", "video", "audio"] },
	{ id: "organization", sectionIds: ["realm", "zone", "collection"] },
	{ id: "vocabulary", sectionIds: ["tag"] },
] as const satisfies readonly {
	readonly id: string;
	readonly sectionIds: readonly StudioSectionId[];
}[];

export type StudioSectionGroupId = (typeof StudioSectionGroups)[number]["id"];

export const StudioTagCreateHref = "/create/tag/new";
export const StudioTagPathCreateHref = "/create/tag/path/new";

export const StudioSectionCreateHrefs = {
	publishing: "/create/publishing/new",
	music: "/create/music/new",
	program: "/create/program/new",
	software: "/create/software/new",
	entity: "/create/entity/new",
	grouping: "/create/grouping/new",
	reference: "/create/reference/new",
	distribution: "/create/distribution/new",
	video: "/create/video/new",
	audio: "/create/audio/new",
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
	publishing: "private_first",
	music: "private_first",
	program: "private_first",
	software: "private_first",
	entity: "private_first",
	grouping: "private_first",
	reference: "private_first",
	distribution: "private_first",
	video: "private_first",
	audio: "private_first",
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

export function studioContentHref(owner: UnitOwner, resource: PublicUnitRouteValue): string {
	if (CatalogOwnerValues.some((candidate) => candidate === owner))
		return `/catalog/${owner}/${resource.id}`;
	if (owner === "tag_path") return `/tag-paths/${resource.id}`;
	const href = publicUnitHref(owner, resource);
	if (!href) throw new Error("Unsupported Studio resource owner");
	return href;
}
