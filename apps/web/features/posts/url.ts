import { type AddressableUnit, zoneHref } from "@/features/slugs/unit-route";

export interface RealmPostContext {
	readonly kind: "realm";
	readonly realmId: string;
}

/**
 * Identifies a Zone presentation context for an ID-addressed Post interaction.
 *
 * @alpha
 * @remarks
 * Zone Post routes are ID-addressed today. If one Post can later receive a
 * different scoped slug in each Zone, the slug registry and this lookup
 * contract must be extended together. The globally unique Post ID remains the
 * stable identity and must not be inferred from a scoped slug.
 */
export interface ZonePostContext {
	readonly kind: "zone";
	readonly zone: AddressableUnit;
}

export type PostInteractionContext = RealmPostContext | ZonePostContext;

export function postCreateHref(defaultRealmId?: string): string {
	return defaultRealmId ? `/posts/new?realmId=${encodeURIComponent(defaultRealmId)}` : "/posts/new";
}

export function postHref(postId: string, context?: PostInteractionContext, hash?: string): string {
	const baseHref =
		context?.kind === "zone"
			? `${zoneHref(context.zone)}/posts/${encodeURIComponent(postId)}`
			: `/posts/${encodeURIComponent(postId)}`;
	const query = context?.kind === "realm" ? `?realmId=${encodeURIComponent(context.realmId)}` : "";
	return `${baseHref}${query}${hash ? `#${hash}` : ""}`;
}

export function postDiscussionHref(postId: string): string {
	return `/posts/${encodeURIComponent(postId)}?from=discussion`;
}
