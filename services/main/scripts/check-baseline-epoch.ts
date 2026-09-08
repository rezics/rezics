import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { z } from "zod";
import { adminDatabaseUrl } from "./admin-database";

const mode = z.enum(["preflight", "installed"]).parse(process.argv[2] ?? "preflight");
const baseline = z.strictObject({ epoch: z.literal("operational-native-20260908"),
	migration: z.literal("20260908000000_operational_target_baseline.sql"),
	replacedHistoryCommit: z.literal("338e950b814148d16649c7817ac04fc826c51f8c"),
	installation: z.literal("fresh-database"),
}).parse(JSON.parse(await readFile(new URL("../src/services/database/baseline.json", import.meta.url), "utf8")));
const version = baseline.migration.slice(0, 14);
const client = new Client({ connectionString: adminDatabaseUrl });
try {
	await client.connect();
	const { rows: [state] } = await client.query<{ legacy: boolean; revisions: boolean; tables: boolean; routing: boolean }>(`
select to_regclass('public.unit') is not null as legacy,
 to_regclass('public.atlas_schema_revisions') is not null as revisions,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p') and c.relname<>'atlas_schema_revisions') as tables,
 to_regclass('public.catalog_routing_control') is not null as routing`);
	if (!state) throw new Error("Database metadata was not returned");
	if (state.legacy) throw new Error("Legacy target rejected: install this epoch into a separate fresh database");
	if (!state.revisions) {
		if (state.tables || mode === "installed") throw new Error("Target is not empty and has no installed native baseline receipt");
		console.info(`Empty target admitted for ${baseline.epoch}`);
	} else {
		const { rows: [receipt] } = await client.query<{ version: string; applied: number; total: number; error: string | null }>(
			"select version,applied,total,error from public.atlas_schema_revisions where version=$1", [version]);
		const anyReceipt = await client.query("select version from public.atlas_schema_revisions limit 1");
		if (mode === "preflight" && !state.tables && anyReceipt.rowCount === 0) {
			console.info(`Empty target with an unused Atlas receipt table admitted for ${baseline.epoch}`);
		} else {
		if (!receipt || receipt.error || receipt.applied !== receipt.total || receipt.total < 1)
			throw new Error("Native baseline receipt is absent or incomplete; review the exact target before retrying");
		const previous = await client.query("select version from public.atlas_schema_revisions where version < $1 limit 1", [version]);
		if (previous.rowCount) throw new Error("Native epoch cannot follow a replay of the replaced migration history");
		if (!state.routing) throw new Error("Native routing publication is missing");
		const { rows: [routing] } = await client.query<{ ready: boolean }>("select ready from public.catalog_routing_control where singleton");
		if (!routing?.ready) throw new Error("Native routing publication is not ready");
		console.info(`Installed ${baseline.epoch} verified; forward migrations may proceed`);
		}
	}
} finally { await client.end(); }
