export const SlugLabelPatternSource = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$";
export const SlugLabelPattern = new RegExp(SlugLabelPatternSource);
export const SlugAddressMaximumDepth = 3;

declare const slugLabelBrand: unique symbol;
export type SlugLabel = string & { readonly [slugLabelBrand]: true };

export function isSlugLabel(value: string): value is SlugLabel {
	return SlugLabelPattern.test(value);
}

export const TopLevelSlugNamespaceUnitIds = {
	users: "019b76da-a800-7000-8000-000000000001",
	realms: "019b76da-a800-7000-8000-000000000002",
	tags: "019b76da-a800-7000-8000-000000000003",
	zones: "019b76da-a800-7000-8000-000000000004",
	entities: "019b76da-a800-7000-8000-000000000005",
} as const;

export type TopLevelSlugNamespace = keyof typeof TopLevelSlugNamespaceUnitIds;

export const PublicSlugRouteManifest = [
	{
		namespaceSlug: "users",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.users,
		canonicalSegment: "user",
		shortSegment: "u",
		targetKind: "profile",
		targetDepth: 2,
	},
	{
		namespaceSlug: "realms",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.realms,
		canonicalSegment: "realm",
		shortSegment: "r",
		targetKind: "realm",
		targetDepth: 2,
	},
	{
		namespaceSlug: "zones",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.zones,
		canonicalSegment: "zone",
		shortSegment: "z",
		targetKind: "zone",
		targetDepth: 2,
	},
] as const;

export type PublicSlugTargetKind = (typeof PublicSlugRouteManifest)[number]["targetKind"];
export type PublicSlugCanonicalSegment =
	(typeof PublicSlugRouteManifest)[number]["canonicalSegment"];
export type PublicSlugShortSegment = (typeof PublicSlugRouteManifest)[number]["shortSegment"];

export interface PublicSlugAddressValue {
	readonly slug: string;
	readonly scopeUnitId: string;
	readonly canonicalPath: readonly string[];
}

export type PublicSlugHrefStyle = "canonical" | "short";

export function publicSlugHref(
	kind: PublicSlugTargetKind,
	address: PublicSlugAddressValue | null | undefined,
	style: PublicSlugHrefStyle = "canonical",
): string | undefined {
	if (!address || !isSlugLabel(address.slug)) return undefined;
	if (
		address.canonicalPath.length < 2 ||
		address.canonicalPath.length > SlugAddressMaximumDepth ||
		address.canonicalPath.some((segment) => !isSlugLabel(segment)) ||
		address.canonicalPath.at(-1) !== address.slug
	)
		return undefined;
	const namespace = address.canonicalPath[0];
	const route = PublicSlugRouteManifest.find(
		(candidate) =>
			candidate.namespaceSlug === namespace &&
			candidate.targetKind === kind &&
			candidate.targetDepth === address.canonicalPath.length,
	);
	if (!route || route.namespaceUnitId !== address.scopeUnitId) return undefined;
	const prefix = style === "canonical" ? route.canonicalSegment : route.shortSegment;
	return `/${[prefix, ...address.canonicalPath.slice(1)].join("/")}`;
}

export function canonicalHrefFromShortPath(
	shortSegment: string,
	path: readonly string[],
): string | undefined {
	const route = PublicSlugRouteManifest.find(
		(candidate) => candidate.shortSegment === shortSegment,
	);
	if (
		!route ||
		path.length !== route.targetDepth - 1 ||
		path.some((segment) => !isSlugLabel(segment))
	)
		return undefined;
	return `/${[route.canonicalSegment, ...path].join("/")}`;
}
