import { Client } from "pg";

import { env } from "../src/services/config";
import {
	CanonicalPgroongaIndexes,
	parseSearchIndexOptions,
	quoteCanonicalPgroongaIndex,
	selectCanonicalPgroongaIndexes,
} from "./search-index-support";

interface IndexState {
	readonly name: string;
	readonly options: readonly string[] | null;
	readonly valid: boolean;
	readonly ready: boolean;
}

const requiredLargeOptions = ["index_flags_mapping", "lexicon_flags_mapping"] as const;

async function check(client: Client): Promise<void> {
	const extensions = await client.query<{ name: string; version: string }>(
		`select extname as name, extversion as version
		 from pg_extension
		 where extname = any($1::text[])
		 order by extname`,
		[["approx_count", "pgroonga"]],
	);
	const installed = new Map(extensions.rows.map((row) => [row.name, row.version]));
	if (installed.get("pgroonga") !== "4.0.8")
		throw new Error(`Expected PGroonga 4.0.8; found ${installed.get("pgroonga") ?? "missing"}`);
	if (installed.get("approx_count") !== "1.0")
		throw new Error(
			`Expected approx_count 1.0; found ${installed.get("approx_count") ?? "missing"}`,
		);

	const result = await client.query<IndexState>(
		`select relation.relname as name,
		        relation.reloptions as options,
		        index_state.indisvalid as valid,
		        index_state.indisready as ready
		 from pg_index index_state
		 join pg_class relation on relation.oid = index_state.indexrelid
		 join pg_namespace namespace on namespace.oid = relation.relnamespace
		 where namespace.nspname = 'public'
		   and relation.relname = any($1::text[])
		 order by relation.relname`,
		[CanonicalPgroongaIndexes],
	);
	const states = new Map(result.rows.map((row) => [row.name, row]));
	for (const index of CanonicalPgroongaIndexes) {
		const state = states.get(index);
		if (!state?.valid || !state.ready)
			throw new Error(`Canonical PGroonga index is missing or invalid: ${index}`);
		for (const option of requiredLargeOptions) {
			if (!state.options?.some((value) => value.startsWith(`${option}=`)))
				throw new Error(`Canonical PGroonga index is not LARGE-capacity: ${index}`);
		}
	}
	console.info("PGroonga 4.0.8, approx_count 1.0, and all LARGE canonical indexes are ready");
}

async function main(): Promise<void> {
	const options = parseSearchIndexOptions(process.argv.slice(2));
	const connectionString = process.env.DATABASE_ADMIN_URL ?? env.DATABASE_URL;
	const client = new Client({ connectionString });
	await client.connect();
	try {
		if (options.action === "check") {
			await check(client);
			return;
		}
		const concurrently = options.action === "reindex-concurrently" ? " CONCURRENTLY" : "";
		for (const index of selectCanonicalPgroongaIndexes(options.index)) {
			await client.query(
				`REINDEX INDEX${concurrently} ${quoteCanonicalPgroongaIndex(index)}`,
			);
			console.info(`Reindexed ${index}${concurrently ? " concurrently" : ""}`);
		}
		await check(client);
	} finally {
		await client.end();
	}
}

await main();
