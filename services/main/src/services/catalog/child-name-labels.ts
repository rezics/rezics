import { sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import type { CatalogOwner } from "@rezics/schema/contracts/native/catalog";

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
	// Match the owner-local preview partial index before LIMIT; scoped or spoiler names never displace a visible label.
	const result = await tx.execute(
		sql`select child.id, candidate.value, candidate.language_tag from unnest(${sql.param(selected)}::uuid[]) child(id) join lateral (select ${name.value} as value, ${name.languageTag} as language_tag from ${name} where ${name.ownerId}=child.id and ${name.state}='active' and ${name.spoiler}=0 and ${name.scopeOwnerId} is null order by ${name.id} limit 1) candidate on true`,
	);
	const rows = z
		.array(z.object({ id: z.uuid(), value: z.string(), language_tag: z.string().nullable() }))
		.parse(result.rows);
	return new Map(rows.map((row) => [row.id, { value: row.value, languageTag: row.language_tag }]));
}
