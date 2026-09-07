import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor } from "../database";
import { catalogSourceProviderBudget as budgets } from "../database/schema/catalog-source";

/** @internal Retryable provider-wide rate admission, not a completed source observation. */
export class CatalogSourceRateLimited extends Error {
	constructor() {
		super("The shared source provider request budget is not currently available");
		this.name = "CatalogSourceRateLimited";
	}
}

/** @internal A bounded three-row authority coordinates all worker replicas before external requests. */
export async function reserveCatalogSourceRequest(database: DatabaseExecutor, source: string) {
	z.enum(["musicbrainz", "vndb", "bangumi"]).parse(source);
	const admitted = await database.transaction(async (tx) => {
		await tx.insert(budgets).values({ source }).onConflictDoNothing();
		const [row] = await tx
			.update(budgets)
			.set({
				nextAllowedAt: sql`clock_timestamp() + ${budgets.minimumIntervalMs} * interval '1 millisecond'`,
			})
			.where(
				and(
					eq(budgets.source, source),
					eq(budgets.enabled, true),
					sql`${budgets.nextAllowedAt} <= clock_timestamp()`,
				),
			)
			.returning({ source: budgets.source });
		return row !== undefined;
	});
	if (!admitted) throw new CatalogSourceRateLimited();
}
