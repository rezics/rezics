import { eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { database } from "../database";
import {
	ContentRatingValues,
	DefaultContentRatingValues,
	profilePreference,
	unit,
	type ContentRating,
} from "../database/schema";

/** A non-empty, canonical list of ratings a viewer has enabled. */
export type AllowedContentRatings = readonly [ContentRating, ...ContentRating[]];

export type ContentRatingPolicy =
	| { readonly kind: "allow"; readonly ratings: AllowedContentRatings }
	| { readonly kind: "none" };

export const DefaultContentRatingPolicy = {
	kind: "allow",
	ratings: DefaultContentRatingValues,
} as const satisfies ContentRatingPolicy;

/**
 * Normalizes values crossing the database boundary. The database enum protects the normal path,
 * but this also keeps a malformed/legacy preference fail-safe and gives callers a non-empty tuple.
 */
export function contentRatingAllowlistFromStored(
	values: readonly unknown[] | null | undefined,
): AllowedContentRatings {
	const normalized = ContentRatingValues.filter((rating) => values?.includes(rating));
	const [first, ...rest] = normalized;
	return first ? [first, ...rest] : [...DefaultContentRatingValues];
}

export async function resolveViewerContentRatings(
	profileId: string | undefined,
): Promise<AllowedContentRatings> {
	if (!profileId) return [...DefaultContentRatingValues];
	const [preference] = await database
		.select({ contentRatings: profilePreference.contentRatings })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, profileId))
		.limit(1);
	return contentRatingAllowlistFromStored(preference?.contentRatings);
}

function intersection(
	base: AllowedContentRatings,
	requested: readonly unknown[],
): AllowedContentRatings | undefined {
	const normalized = ContentRatingValues.filter(
		(rating) => base.includes(rating) && requested.includes(rating),
	);
	const [first, ...rest] = normalized;
	return first ? [first, ...rest] : undefined;
}

/**
 * Applies a request-level rating filter without allowing it to widen the viewer's preference.
 * Invalid-only and disjoint requests become match-none rather than unrestricted.
 */
export function resolveContentRatingPolicy(
	base: AllowedContentRatings,
	requested: readonly unknown[] | undefined,
): ContentRatingPolicy {
	if (!requested?.length) return { kind: "allow", ratings: base };
	const ratings = intersection(base, requested);
	return ratings ? { kind: "allow", ratings } : { kind: "none" };
}

export function contentRatingPolicyFromAllowlist(
	ratings: AllowedContentRatings,
): ContentRatingPolicy {
	return { kind: "allow", ratings };
}

export function contentRatingPolicyKey(policy: ContentRatingPolicy): string {
	return policy.kind === "none" ? "none" : policy.ratings.join(",");
}

export function getContentRatingCondition(
	policy: ContentRatingPolicy,
	target: SQLWrapper = sql`${unit.contentRating}`,
): SQL {
	if (policy.kind === "none") return sql`false`;
	return sql`${target} in (${sql.join(
		policy.ratings.map((rating) => sql`${rating}`),
		sql`, `,
	)})`;
}
