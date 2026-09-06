import { isDeepStrictEqual } from "node:util";
import { Client } from "pg";
import { z } from "zod";
import {
	ContentLanguageRegistryPolicy,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";

const connectionString = process.env.DATABASE_INVENTORY_URL;
if (!connectionString) throw new Error("DATABASE_INVENTORY_URL is required");
const after = process.argv[2] ? z.uuid().parse(process.argv[2]) : null;
const limit = process.argv[3]
	? z.coerce.number().int().min(1).max(1_000).parse(process.argv[3])
	: 500;
const client = new Client({
	connectionString,
	connectionTimeoutMillis: 5_000,
	statement_timeout: 10_000,
	application_name: "rezics-language-contract-audit",
});
await client.connect();
try {
	await client.query("begin read only");
	const rows = z.array(z.object({ unitId: z.uuid(), value: z.unknown() })).parse(
		(
			await client.query(
				`select unit_id as "unitId", value from public.unit_content_language_support
				${after ? "where unit_id > $1::uuid" : ""} order by unit_id limit $${after ? 2 : 1}`,
				after ? [after, limit + 1] : [limit + 1],
			)
		).rows,
	);
	const page = rows.slice(0, limit);
	const findings = page.flatMap((row) => {
		try {
			const normalized = normalizeContentLanguageSupport(row.value);
			return isDeepStrictEqual(row.value, normalized)
				? []
				: [
						{
							unitId: row.unitId,
							disposition: "conversion_required",
							original: row.value,
							normalized,
						},
					];
		} catch {
			return [{ unitId: row.unitId, disposition: "quarantine_required", original: row.value }];
		}
	});
	console.info(
		JSON.stringify({
			policy: ContentLanguageRegistryPolicy,
			scanned: page.length,
			unchanged: page.length - findings.length,
			findings,
			nextAfter: rows.length > limit ? page.at(-1)?.unitId : null,
			writes: false,
			historyAudited: false,
		}),
	);
} finally {
	await client.query("rollback");
	await client.end();
}
