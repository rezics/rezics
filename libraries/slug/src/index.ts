export const SlugLabelPatternSource = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$";
export const SlugLabelPattern = new RegExp(SlugLabelPatternSource);
export const SlugAddressMaximumDepth = 3;
export const ZoneHomePageSlug = "home";
export const ZoneReservedPageSlugs = ["manage", "page", "posts", "search"] as const;
/**
 * Profile labels held back from ordinary self-service assignment.
 *
 * @remarks
 * This is a temporary product-governance list, not part of the persisted slug
 * label format. It may be revised as first-party Profile addressing matures.
 *
 * @alpha
 */
export const ProfileReservedSlugs = [
	"about",
	"admin",
	"administrator",
	"api",
	"auth",
	"console",
	"contact",
	"help",
	"login",
	"logout",
	"me",
	"moderator",
	"official",
	"register",
	"rezics",
	"root",
	"security",
	"settings",
	"staff",
	"support",
	"system",
	"www",
] as const;

const ZoneReservedPageSlugSet: ReadonlySet<string> = new Set(ZoneReservedPageSlugs);
const ProfileReservedSlugSet: ReadonlySet<string> = new Set(ProfileReservedSlugs);

declare const slugLabelBrand: unique symbol;
export type SlugLabel = string & { readonly [slugLabelBrand]: true };

export function isSlugLabel(value: string): value is SlugLabel {
	return SlugLabelPattern.test(value);
}

export function isAvailableZonePageSlug(value: string): value is SlugLabel {
	return isSlugLabel(value) && !ZoneReservedPageSlugSet.has(value);
}

/** Returns whether a label is held back from ordinary Profile assignment. */
export function isProfileSlugReserved(value: string): boolean {
	return ProfileReservedSlugSet.has(value);
}

/** Proves that a label satisfies both the storage format and Profile policy. */
export function isAvailableProfileSlug(value: string): value is SlugLabel {
	return isSlugLabel(value) && !isProfileSlugReserved(value);
}

export const TopLevelSlugNamespaceUnitIds = {
	users: "019b76da-a800-7000-8000-000000000001",
	realms: "019b76da-a800-7000-8000-000000000002",
	tags: "019b76da-a800-7000-8000-000000000003",
	zones: "019b76da-a800-7000-8000-000000000004",
	entities: "019b76da-a800-7000-8000-000000000005",
} as const;

export const OfficialRealmUnitIds = {
	community: "019b76da-a800-7300-8000-000000000001",
	score: "019b76da-a800-7300-8000-000000000002",
	rule: "019b76da-a800-7300-8000-000000000003",
} as const;

export type TopLevelSlugNamespace = keyof typeof TopLevelSlugNamespaceUnitIds;

export const PublicSlugRouteManifest = [
	{
		namespaceSlug: "users",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.users,
		idSegment: "user",
		slugSegment: "u",
		targetKind: "profile",
		targetDepth: 2,
	},
	{
		namespaceSlug: "realms",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.realms,
		idSegment: "realm",
		slugSegment: "r",
		targetKind: "realm",
		targetDepth: 2,
	},
	{
		namespaceSlug: "zones",
		namespaceUnitId: TopLevelSlugNamespaceUnitIds.zones,
		idSegment: "zone",
		slugSegment: "z",
		targetKind: "zone",
		targetDepth: 2,
	},
] as const;

export type PublicSlugTargetKind = (typeof PublicSlugRouteManifest)[number]["targetKind"];
export type PublicUnitIdSegment = (typeof PublicSlugRouteManifest)[number]["idSegment"];
export type PublicSlugSegment = (typeof PublicSlugRouteManifest)[number]["slugSegment"];

export interface PublicSlugAddressValue {
	readonly slug: string;
	readonly scopeUnitId: string;
	readonly canonicalPath: readonly string[];
}

export function publicSlugHref(
	kind: PublicSlugTargetKind,
	address: PublicSlugAddressValue | null | undefined,
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
	return `/${[route.slugSegment, ...address.canonicalPath.slice(1)].join("/")}`;
}

export function publicUnitIdHref(kind: PublicSlugTargetKind, unitId: string): string {
	const route = PublicSlugRouteManifest.find((candidate) => candidate.targetKind === kind);
	if (!route) throw new Error(`Unsupported public Unit kind: ${kind}`);
	return `/${route.idSegment}/${encodeURIComponent(unitId)}`;
}
