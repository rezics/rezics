import { sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogOwner } from "./contracts";

export const CatalogNameLabelSchema = z.strictObject({
	value: z.string(),
	languageTag: z.string().nullable(),
});
/** Labels for child IDs already filtered by their owner's read policy. @internal */
export async function readAuthorizedChildNameLabels(
	tx: DatabaseTransaction,
	owner: CatalogOwner,
	ids: readonly string[],
) {
	const selected = z
		.array(z.uuid())
		.max(100)
		.parse([...new Set(ids)]);
	if (!selected.length) return new Map<string, z.output<typeof CatalogNameLabelSchema>>();
	const name = CatalogFactTables[owner].name;
	// A hot identity never makes this scan an unbounded alias set: at most 50 indexed rows per child.
	const result = await tx.execute(
		sql`select child.id, candidate.value, candidate.language_tag from unnest(${sql.param(selected)}::uuid[]) child(id) join lateral (select available.value, available.language_tag from (select ${name.id} as name_id, ${name.value} as value, ${name.languageTag} as language_tag, ${name.spoiler} as spoiler, ${name.scopeOwnerId} as scope_owner_id from ${name} where ${name.ownerId}=child.id and ${name.state}='active' order by ${name.id} limit 50) available where available.spoiler=0 and available.scope_owner_id is null order by available.name_id limit 1) candidate on true`,
	);
	const rows = z
		.array(z.object({ id: z.uuid(), value: z.string(), language_tag: z.string().nullable() }))
		.parse(result.rows);
	return new Map(rows.map((row) => [row.id, { value: row.value, languageTag: row.language_tag }]));
}
