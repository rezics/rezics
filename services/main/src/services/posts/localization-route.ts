import type { PostKind } from "../database/schema/contract-values";

const SharedPostLocalizationRouteKindValues = [
	"post",
	"reply",
	"excerpt",
	"wiki",
] as const satisfies readonly PostKind[];
const sharedPostLocalizationRouteKinds: ReadonlySet<PostKind> = new Set(
	SharedPostLocalizationRouteKindValues,
);

type SharedPostLocalizationRouteKind = (typeof SharedPostLocalizationRouteKindValues)[number];

/**
 * Identifies storage formats handled safely by the shared Post localization mutation.
 *
 * @remarks
 * This is a mutation-format boundary, not an editing authorization policy. Structural
 * Post kinds use owner-specific mutations that preserve their additional invariants.
 *
 * @internal
 */
export function usesSharedPostLocalizationRoute(
	kind: PostKind,
): kind is SharedPostLocalizationRouteKind {
	return sharedPostLocalizationRouteKinds.has(kind);
}
