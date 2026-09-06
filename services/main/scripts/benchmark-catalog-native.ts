import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { users } from "../src/services/database/schema/auth";
import {
	createCatalogIdentity,
	ensureCatalogDefinition,
	findCatalogRelations,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit loopback disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== "/rezics" ||
	url.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")
)
	throw new Error("Catalog benchmark requires rezics-dev PostgreSQL");

const pool = new Pool({ connectionString, max: 1, statement_timeout: 60_000 });
let captured: { query: string; params: unknown[] } | null = null;
const database = drizzle({
	client: pool,
	logger: {
		logQuery(query, params) {
			if (query.startsWith("select") && query.includes('from "grouping_catalog_relation"'))
				captured = { query, params };
		},
	},
});
const rollback = new Error("rollback catalog query benchmark");
const planSchema = z.array(z.record(z.string(), z.unknown())).min(1);

function planSummary(value: unknown): {
	nodeTypes: string[];
	indexes: string[];
	sharedHits: number;
	sharedReads: number;
} {
	const nodeTypes = new Set<string>();
	const indexes = new Set<string>();
	const walk = (node: unknown) => {
		const record = z.record(z.string(), z.unknown()).parse(node);
		if (typeof record["Node Type"] === "string") nodeTypes.add(record["Node Type"]);
		if (typeof record["Index Name"] === "string") indexes.add(record["Index Name"]);
		if (Array.isArray(record.Plans)) record.Plans.forEach(walk);
	};
	walk(value);
	const root = z.record(z.string(), z.unknown()).parse(value);
	return {
		nodeTypes: [...nodeTypes],
		indexes: [...indexes],
		sharedHits: z.number().parse(root["Shared Hit Blocks"]),
		sharedReads: z.number().parse(root["Shared Read Blocks"]),
	};
}

try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Catalog query benchmark",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			const owner = await createCatalogIdentity(
				tx,
				{ owner: "grouping", shape: "benchmark" },
				actor,
			);
			const common = await createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "benchmark" },
				actor,
			);
			const rare = await createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "benchmark" },
				actor,
			);
			const first = await createCatalogIdentity(
				tx,
				{ owner: "grouping", shape: "benchmark" },
				actor,
			);
			const second = await createCatalogIdentity(
				tx,
				{ owner: "grouping", shape: "benchmark" },
				actor,
			);
			const predicate = await ensureCatalogDefinition(tx, {
				namespace: "benchmark",
				key: "participation",
				kind: "predicate",
				valueKind: null,
			});
			const subject = await ensureCatalogDefinition(tx, {
				namespace: "benchmark",
				key: "subject",
				kind: "role",
				valueKind: null,
			});
			const context = await ensureCatalogDefinition(tx, {
				namespace: "benchmark",
				key: "context",
				kind: "role",
				valueKind: null,
			});
			const started = performance.now();
			await tx.execute(sql`insert into public.grouping_catalog_relation(owner_id, definition_revision_id)
				select ${owner.id}::uuid, ${predicate.revisionId}::uuid from generate_series(1, 50000)`);
			await tx.execute(sql`with numbered as (
				select id, row_number() over (order by id) as number from public.grouping_catalog_relation where owner_id = ${owner.id}::uuid
			) insert into public.grouping_relation_participant(owner_id, relation_id, role_revision_id, position, publishing_id)
			select ${owner.id}::uuid, id, ${subject.revisionId}::uuid, 0,
			case when number % 1000 = 0 then ${rare.id}::uuid else ${common.id}::uuid end from numbered`);
			await tx.execute(sql`with numbered as (
				select id, row_number() over (order by id) as number from public.grouping_catalog_relation where owner_id = ${owner.id}::uuid
			) insert into public.grouping_relation_participant(owner_id, relation_id, role_revision_id, position, grouping_id)
			select ${owner.id}::uuid, id, ${context.revisionId}::uuid, 1,
			case when number % 2 = 0 then ${second.id}::uuid else ${first.id}::uuid end from numbered`);
			await tx.execute(sql`analyze public.grouping_catalog_relation`);
			await tx.execute(sql`analyze public.grouping_relation_participant`);
			console.info(
				JSON.stringify({
					fixtureRelations: 50_000,
					fixtureParticipants: 100_000,
					loadMilliseconds: performance.now() - started,
				}),
			);
			for (const [label, target, expected] of [
				["matching-context", second, 50],
				["different-context", first, 0],
			] as const) {
				const result = await findCatalogRelations(tx, owner, actor, predicate.revisionId, {
					participants: [
						{ roleRevisionId: subject.revisionId, target: rare },
						{ roleRevisionId: context.revisionId, target },
					],
				});
				assert.equal(result.length, expected);
				const statement = captured;
				assert.ok(statement);
				const queryParts = statement.query.split(/\$(\d+)/u).map((part, index) => {
					if (index % 2 === 0) return sql.raw(part);
					const value = statement.params[Number(part) - 1];
					if (value !== null && typeof value !== "string" && typeof value !== "number")
						throw new TypeError("Unexpected benchmark SQL parameter");
					return sql`${value}`;
				});
				const plans = await tx.execute<Record<string, unknown>>(
					sql`explain (analyze, buffers, format json) ${sql.join(queryParts, sql``)}`,
				);
				const [plan] = planSchema.parse(plans.rows[0]?.["QUERY PLAN"]);
				assert.ok(plan);
				console.info(
					JSON.stringify({
						label,
						rows: result.length,
						executionMilliseconds: plan["Execution Time"],
						...planSummary(plan.Plan),
					}),
				);
			}
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info("Rolled back benchmark rows; these local plans do not qualify 500M/3B capacity");
} finally {
	await pool.end();
}
