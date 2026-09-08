import { AsyncLocalStorage } from "node:async_hooks";
import { eq, sql, type SQLWrapper } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { accountPreference } from "../database/schema/account-preference";
import {
	ContentRatingValues,
	DefaultContentRatingValues,
	type ContentRating,
} from "../database/schema/contract-values";

const readRatings = new AsyncLocalStorage<readonly ContentRating[]>();

/** The HTTP adapter takes preferences from the private Auth account, independently of its acting Entity. @internal */
export async function withCatalogViewerPolicy<T>(
	tx: DatabaseTransaction,
	authUserId: string | null,
	work: () => Promise<T>,
): Promise<T> {
	const [preference] =
		authUserId === null
			? []
			: await tx
					.select({ ratings: accountPreference.contentRatings })
					.from(accountPreference)
					.where(eq(accountPreference.authUserId, authUserId))
					.limit(1);
	const selected = ContentRatingValues.filter((value) => preference?.ratings.includes(value));
	return readRatings.run(selected.length ? selected : DefaultContentRatingValues, work);
}

export function catalogRatingReadable(rating: ContentRating) {
	return readRatings.getStore()?.includes(rating) ?? true;
}

/** Native maintenance without an HTTP viewer retains its existing explicit authority rules. @internal */
export function catalogReadRatingPredicate(column: SQLWrapper) {
	const ratings = readRatings.getStore();
	return ratings
		? sql`${column} in (${sql.join(
				ratings.map((value) => sql`${value}`),
				sql`, `,
			)})`
		: sql`true`;
}
