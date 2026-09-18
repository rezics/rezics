import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import { users } from "@rezics/schema/postgres/identity/auth";
import { post } from "@rezics/schema/postgres/forum/post";
import {
	recommendationSnapshot,
	recommendationSnapshotPartition,
	unitBestScore,
} from "@rezics/schema/postgres/discovery/recommendation";
import {
	admitRecommendationSnapshot,
	advanceRecommendationPartition,
	claimRecommendationPartition,
	finalizeRecommendationSnapshot,
	failRecommendationPartition,
	RecommendationPartitionLeaseSchema,
} from "../src/services/recommendations/build-partitions";
import {
	RecommendationPolicy,
	RecommendationPolicyVersion,
} from "../src/services/recommendations/policy";

const connectionString = process.env.DATABASE_URL;
if (process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable recommendation-build fixture required");
if (connectionString === undefined) throw new Error("DATABASE_URL is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Requires isolated loopback Atlas target");

const SignalKinds = [
	"impression",
	"open",
	"dwell_30s",
	"not_interested",
	"upvote",
	"downvote",
	"reply",
	"favorite",
	"share",
	"score_high",
	"score_medium",
	"score_low",
	"progress_active",
	"progress_completed",
	"progress_dropped",
] as const;
const LargeHours = 91;
const MaximumFixturePages = 128;
const BackgroundUnits = 24;
const BackgroundHours = 96;
const SiblingHours = 4;
const FixtureTrigger = "recommendation_build_fixture_fail";
const FixtureFunction = "recommendation_build_fixture_fail";
const UnitStateRow = z.object({
	id: z.string().uuid(),
	owner: z.string().min(1),
	shape: z.string().min(1),
	status: z.literal("published"),
	visibility: z.literal("public"),
	moderation_status: z.literal("approved"),
	deleted_at: z.null(),
});
const PartitionRow = z.object({
	bucket: z.coerce.number().int().min(0).max(63),
	state: z.enum(["pending", "working", "done", "failed"]),
	generation: z.coerce.number().int().nonnegative(),
	leaseToken: z.string().uuid().nullable(),
	scannedRows: z.coerce.bigint(),
	afterBucketStart: z.coerce.date().nullable(),
	afterUnitId: z.string().uuid().nullable(),
	afterKind: z.string().nullable(),
});
const ScoreRow = z.object({
	unitId: z.string().uuid(),
	score: z.number().finite().positive(),
});
const ChildRow = z.object({
	name: z.string(),
	bound: z.string(),
	key: z.string(),
});
const CountRow = z.object({ n: z.coerce.number().int() });
const IdRow = z.object({ id: z.string().uuid() });
const TextRow = z.object({ value: z.string() });
const ExplainNode = z
	.object({
		"Node Type": z.string().optional(),
		"Index Name": z.string().nullable().optional(),
		"Relation Name": z.string().nullable().optional(),
		Plan: z.unknown().optional(),
		Plans: z.array(z.unknown()).optional(),
		"Execution Time": z.number().optional(),
	})
	.passthrough();

const pool = new Pool({
	connectionString,
	max: 8,
	statement_timeout: 60_000,
	application_name: "recommendation-build-fixture",
});
const database = drizzle({ client: pool });
let assertions = 0;
const timings: Record<string, number> = {};
const triggerInstalled = { value: false };

function checked(condition: unknown, message?: string): asserts condition {
	if (message === undefined) assert.ok(condition);
	else assert.ok(condition, message);
	assertions++;
}
function equal(actual: unknown, expected: unknown, message?: string) {
	if (message === undefined) assert.equal(actual, expected);
	else assert.equal(actual, expected, message);
	assertions++;
}
function pgCode(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;
	if ("code" in error && typeof error.code === "string") return error.code;
	return "cause" in error ? pgCode(error.cause) : undefined;
}
async function rejectsCode(work: () => Promise<unknown>, code: string, message?: string) {
	await assert.rejects(work, (error: unknown) => pgCode(error) === code, message);
	assertions++;
}
function childName(table: string, bucket: number) {
	const name = `${table}_p${String(bucket).padStart(2, "0")}`;
	checked(/^[a-z_]+_p\d{2}$/u.test(name), `unexpected child name ${name}`);
	return name;
}
function visitPlan(node: unknown, names: string[], indexes: string[], relations: string[]) {
	const parsed = ExplainNode.safeParse(node);
	if (!parsed.success) return;
	if (parsed.data["Node Type"]) names.push(parsed.data["Node Type"]);
	if (parsed.data["Index Name"]) indexes.push(parsed.data["Index Name"]);
	if (parsed.data["Relation Name"]) relations.push(parsed.data["Relation Name"]);
	if (parsed.data.Plan) visitPlan(parsed.data.Plan, names, indexes, relations);
	for (const child of parsed.data.Plans ?? []) visitPlan(child, names, indexes, relations);
}
function explainTree(rows: unknown) {
	const packed = z.array(z.object({ "QUERY PLAN": z.unknown() })).parse(rows);
	const first = packed[0];
	checked(first, "EXPLAIN JSON is empty");
	const payload = Array.isArray(first["QUERY PLAN"]) ? first["QUERY PLAN"][0] : first["QUERY PLAN"];
	const nodes: string[] = [];
	const indexes: string[] = [];
	const relations: string[] = [];
	visitPlan(payload, nodes, indexes, relations);
	const executionTime = ExplainNode.safeParse(payload).success
		? ExplainNode.parse(payload)["Execution Time"]
		: undefined;
	return { nodes, indexes, relations, executionTime, text: JSON.stringify(rows) };
}
async function explainIndexPlan(query: string, params: Array<string | Date | number>) {
	const client = await pool.connect();
	try {
		await client.query("begin");
		await client.query("set local enable_seqscan = off");
		return explainTree(
			(await client.query(`explain (analyze, buffers, format json) ${query}`, params)).rows,
		);
	} finally {
		try {
			await client.query("rollback");
		} finally {
			client.release();
		}
	}
}

async function assertHash64(table: string) {
	const children = await pool.query(
		`select c.relname as name, pg_get_expr(c.relpartbound, c.oid) as bound, pg_get_partkeydef(p.oid) as key
		 from pg_inherits i
		 join pg_class p on p.oid = i.inhparent
		 join pg_namespace n on n.oid = p.relnamespace
		 join pg_class c on c.oid = i.inhrelid
		 where n.nspname = 'public' and p.relname = $1
		 order by c.relname`,
		[table],
	);
	equal(
		children.rows.length,
		RecommendationPolicy.buildPartitions,
		`${table} must have 64 children`,
	);
	for (let bucket = 0; bucket < RecommendationPolicy.buildPartitions; bucket++) {
		assert.deepEqual(
			ChildRow.parse(children.rows[bucket]),
			{
				name: childName(table, bucket),
				key: "HASH (unit_id)",
				bound: `FOR VALUES WITH (modulus 64, remainder ${bucket})`,
			},
			`${table} child ${bucket} is not the reviewed HASH(unit_id) layout`,
		);
		assertions++;
	}
}

async function idsForRemainder(remainder: number, count: number) {
	const found: string[] = [];
	for (let round = 0; round < 32 && found.length < count; round++) {
		const result = await pool.query(
			`select id from (
				select gen_random_uuid() as id from generate_series(1, 1024)
			) candidates
			where satisfies_hash_partition(
				'public.recommendation_unit_signal_hourly'::regclass, 64, $1, candidates.id
			)
			limit $2`,
			[remainder, count - found.length],
		);
		for (const row of result.rows) {
			const id = IdRow.parse(row).id;
			if (!found.includes(id)) found.push(id);
		}
	}
	equal(found.length, count, `need ${count} native IDs hashing to remainder ${remainder}`);
	return found;
}

async function requirePublished(id: string) {
	const result = await pool.query(`select * from public.read_unit_state($1::uuid, false)`, [id]);
	const row = UnitStateRow.parse(result.rows[0]);
	equal(row.id, id);
	return row;
}

async function partitionOf(snapshotId: string, bucket: number) {
	const [row] = await database
		.select({
			bucket: recommendationSnapshotPartition.bucket,
			state: recommendationSnapshotPartition.state,
			generation: recommendationSnapshotPartition.generation,
			leaseToken: recommendationSnapshotPartition.leaseToken,
			scannedRows: recommendationSnapshotPartition.scannedRows,
			afterBucketStart: recommendationSnapshotPartition.afterBucketStart,
			afterUnitId: recommendationSnapshotPartition.afterUnitId,
			afterKind: recommendationSnapshotPartition.afterKind,
		})
		.from(recommendationSnapshotPartition)
		.where(
			and(
				eq(recommendationSnapshotPartition.snapshotId, snapshotId),
				eq(recommendationSnapshotPartition.bucket, bucket),
			),
		)
		.limit(1);
	return PartitionRow.parse(row);
}

async function scoresOf(snapshotId: string) {
	const rows = await database
		.select({ unitId: unitBestScore.unitId, score: unitBestScore.score })
		.from(unitBestScore)
		.where(eq(unitBestScore.snapshotId, snapshotId));
	return rows
		.map((row) => ScoreRow.parse(row))
		.sort((left, right) => left.unitId.localeCompare(right.unitId));
}

async function expectedScores(child: string, watermark: Date, limit: number | null) {
	checked(/^[a-z_]+_p\d{2}$/u.test(child), `refusing to interpolate ${child}`);
	const result = await pool.query(
		`with batch as materialized (
			select unit_id, bucket_start, kind, weight
			from public.${child}
			where bucket_start >= $1::timestamptz - ($2::int * interval '1 day')
			  and bucket_start < $1::timestamptz
			  and weight > 0
			order by bucket_start, unit_id, kind
			${limit === null ? "" : "limit $4"}
		)
		select unit_id as "unitId",
			sum(weight * exp(-ln(2) * extract(epoch from ($1::timestamptz - bucket_start)) / $3))::double precision as score
		from batch
		group by unit_id
		order by unit_id`,
		limit === null
			? [
					watermark,
					RecommendationPolicy.bestWindowDays,
					RecommendationPolicy.bestHalfLifeHours * 3600,
				]
			: [
					watermark,
					RecommendationPolicy.bestWindowDays,
					RecommendationPolicy.bestHalfLifeHours * 3600,
					limit,
				],
	);
	return result.rows.map((row) => ScoreRow.parse(row));
}

function scoresMatch(
	actual: { unitId: string; score: number }[],
	expected: { unitId: string; score: number }[],
) {
	equal(
		actual.length,
		expected.length,
		"score cardinality drifted from the scanned positive batch",
	);
	for (const [index, row] of expected.entries()) {
		const got = actual[index];
		checked(got, "missing score row");
		equal(got.unitId, row.unitId);
		checked(
			Math.abs(got.score - row.score) <= Math.max(1e-9, Math.abs(row.score) * 1e-9),
			`score ${got.unitId} ${got.score} != ${row.score}`,
		);
	}
}

async function installFixtureTrigger() {
	await pool.query(
		`create function public.${FixtureFunction}()
		 returns trigger language plpgsql set search_path = pg_catalog, public as $fail$
		 begin
			raise exception 'injected recommendation score write failure' using errcode = '40001';
		 end
		 $fail$;
		 create trigger ${FixtureTrigger}
		 before insert or update on public.unit_best_score
		 for each row execute function public.${FixtureFunction}();`,
	);
	triggerInstalled.value = true;
}

async function dropFixtureTrigger() {
	await pool.query(
		`do $cleanup$
		declare child regclass;
		begin
			drop trigger if exists ${FixtureTrigger} on public.unit_best_score;
			for child in
				select inhrelid::regclass
				from pg_inherits i
				join pg_class p on p.oid = i.inhparent
				join pg_namespace n on n.oid = p.relnamespace
				where n.nspname = 'public' and p.relname = 'unit_best_score'
			loop
				execute format('drop trigger if exists ${FixtureTrigger} on %s', child);
			end loop;
			drop function if exists public.${FixtureFunction}();
		end
		$cleanup$;`,
	);
	triggerInstalled.value = false;
}

async function drainSnapshot(id: string) {
	let pages = 0,
		emptyPages = 0;
	for (; pages < MaximumFixturePages; pages++) {
		const lease = await claimRecommendationPartition(database, id);
		if (!lease) return { pages, emptyPages };
		const advanced = await advanceRecommendationPartition(database, lease);
		checked(advanced.status === "done" || advanced.status === "advanced");
		if (advanced.scannedRows === 0) emptyPages++;
	}
	throw new Error("The fixed recommendation fixture exceeded its 128-page budget");
}

async function advanceSameLeaseConcurrently(
	lease: z.infer<typeof RecommendationPartitionLeaseSchema>,
) {
	const firstPool = new Pool({
		connectionString,
		max: 1,
		application_name: "recommendation-race-first",
	});
	const secondPool = new Pool({
		connectionString,
		max: 1,
		application_name: "recommendation-race-second",
	});
	const holder = await pool.connect();
	try {
		const firstPid = (await firstPool.query("select pg_backend_pid() as pid")).rows[0].pid;
		const secondPid = (await secondPool.query("select pg_backend_pid() as pid")).rows[0].pid;
		await holder.query("begin");
		await holder.query(
			"select 1 from recommendation_snapshot_partition where snapshot_id=$1 and bucket=$2 for update",
			[lease.snapshotId, lease.bucket],
		);
		const blocker = (await holder.query("select pg_backend_pid() as pid")).rows[0].pid;
		const working = Promise.all([
			advanceRecommendationPartition(drizzle({ client: firstPool }), lease),
			advanceRecommendationPartition(drizzle({ client: secondPool }), lease),
		]);
		void working.catch(() => {});
		try {
			let blocked = false;
			for (let attempt = 0; attempt < 200; attempt++) {
				blocked =
					(
						await pool.query(
							`select
					($3::integer=any(pg_blocking_pids($1)) or
					 exists(select 1 from unnest(pg_blocking_pids($1)) waiter where waiter=$2 and $3::integer=any(pg_blocking_pids(waiter))))
					and ($3::integer=any(pg_blocking_pids($2)) or
					 exists(select 1 from unnest(pg_blocking_pids($2)) waiter where waiter=$1 and $3::integer=any(pg_blocking_pids(waiter)))) as blocked`,
							[firstPid, secondPid, blocker],
						)
					).rows[0]?.blocked === true;
				if (blocked) break;
				await setTimeout(10);
			}
			checked(blocked, "Both same-lease workers must wait on the exact partition holder");
		} finally {
			await holder.query("commit");
		}
		const results = await working;
		assert.deepEqual(results.map((result) => result.status).sort(), ["advanced", "stale"]);
		assertions++;
		equal(
			results.reduce((sum, result) => sum + result.scannedRows, 0),
			RecommendationPolicy.buildBatchSize,
		);
	} finally {
		holder.release();
		await Promise.all([firstPool.end(), secondPool.end()]);
	}
}

try {
	equal(RecommendationPolicy.buildPartitions, 64);
	equal(RecommendationPolicy.buildBatchSize, 4096);
	await assertHash64("recommendation_unit_signal_hourly");
	await assertHash64("unit_best_score");
	const positiveIndex = await pool.query(
		`select c.relname as value
		 from pg_index ix
		 join pg_class t on t.oid = ix.indrelid
		 join pg_class c on c.oid = ix.indexrelid
		 join pg_namespace n on n.oid = t.relnamespace
		 where n.nspname = 'public'
		   and t.relname in ('recommendation_unit_signal_hourly', $1)
		   and ix.indisvalid
		   and pg_get_expr(ix.indpred, ix.indrelid) is not null
		   and pg_get_expr(ix.indpred, ix.indrelid) like '%weight%0%'`,
		[childName("recommendation_unit_signal_hourly", 0)],
	);
	checked(
		positiveIndex.rows.length > 0,
		"positive partial index is missing on the signal relation",
	);

	checked(
		(await pool.query("select 1 from public.recommendation_snapshot limit 1")).rows.length === 0,
		"Fixture requires a fresh recommendation snapshot lane",
	);
	checked(
		(await pool.query("select 1 from public.recommendation_unit_signal_hourly limit 1")).rows
			.length === 0,
		"Fixture must not mix another signal corpus into its scoring assertions",
	);
	checked(
		(
			await pool.query(
				"select to_regprocedure('public.recommendation_build_fixture_fail()') as name",
			)
		).rows[0]?.name === null,
		"Fixture must not replace an existing function",
	);

	const largeIds = await idsForRemainder(0, 3);
	const siblingIds = await idsForRemainder(1, 1);
	const backgroundIds = await idsForRemainder(0, BackgroundUnits);
	const postA = largeIds[0];
	const postB = largeIds[1];
	const workId = largeIds[2];
	const siblingId = siblingIds[0];
	const postC = crypto.randomUUID();
	checked(postA && postB && workId && siblingId);

	const actorId = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Recommendation build fixture",
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		checked(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		const authority = {
			principal: { kind: "auth" as const, authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		await tx.insert(post).values({
			id: postA,
			kind: "post",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			publishedAt: sql`clock_timestamp()`,
			createdByAuthUserId: account.id,
		});
		await tx.insert(post).values({
			id: postB,
			kind: "post",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			publishedAt: sql`clock_timestamp()`,
			createdByAuthUserId: account.id,
		});
		await tx.insert(post).values({
			id: postC,
			kind: "post",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			publishedAt: sql`clock_timestamp()`,
			createdByAuthUserId: account.id,
		});
		await tx.insert(post).values(
			backgroundIds.map((id) => ({
				id,
				kind: "post" as const,
				status: "published" as const,
				visibility: "public" as const,
				moderationStatus: "approved" as const,
				publishedAt: sql`clock_timestamp()`,
				createdByAuthUserId: account.id,
			})),
		);
		await runWithParticipationAuthority(authority, async () => {
			await createCatalogIdentity(
				tx,
				{
					id: workId,
					owner: "publishing",
					shape: "work",
					status: "published",
					visibility: "public",
				},
				account.id,
			);
			await createCatalogIdentity(
				tx,
				{
					id: siblingId,
					owner: "entity",
					shape: "person",
					status: "published",
					visibility: "public",
				},
				account.id,
			);
		});
		return account.id;
	});
	checked(z.string().uuid().safeParse(actorId).success);
	equal((await requirePublished(postA)).owner, "post");
	equal((await requirePublished(postB)).owner, "post");
	equal((await requirePublished(postC)).owner, "post");
	equal((await requirePublished(workId)).owner, "publishing");
	equal((await requirePublished(siblingId)).owner, "entity");

	await rejectsCode(
		() =>
			pool.query(
				`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
				 values ($1::uuid, date_trunc('hour', clock_timestamp(), 'UTC') - interval '1 hour', 'upvote', 1, 'Infinity'::double precision)`,
				[postA],
			),
		"23514",
		"infinite weights must be rejected",
	);
	await rejectsCode(
		() =>
			pool.query(
				`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
				 values ($1::uuid, date_trunc('hour', clock_timestamp(), 'UTC') - interval '2 hours', 'upvote', 1, -1)`,
				[postA],
			),
		"23514",
		"negative weights must be rejected",
	);
	await rejectsCode(
		() =>
			pool.query(
				`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
				 values ($1::uuid, date_trunc('hour', clock_timestamp(), 'UTC') - interval '3 hours', 'upvote', 1, 'NaN'::double precision)`,
				[postA],
			),
		"23514",
		"NaN weights must be rejected",
	);

	const rollbackAdmission = new Error("rollback recommendation admission probe");
	try {
		await database.transaction(async (tx) => {
			checked(
				await admitRecommendationSnapshot(tx),
				"admission must create a building snapshot on a quiet target",
			);
			throw rollbackAdmission;
		});
	} catch (error) {
		if (error !== rollbackAdmission) throw error;
	}
	const snapshotId = await database.transaction(async (tx) => {
		const [created] = await tx
			.insert(recommendationSnapshot)
			.values({
				policyVersion: RecommendationPolicyVersion,
				sourceWatermark: sql`date_trunc('hour',clock_timestamp(),'UTC')-interval '1 hour'`,
			})
			.returning({ id: recommendationSnapshot.id });
		checked(created);
		await tx.insert(recommendationSnapshotPartition).values(
			Array.from({ length: RecommendationPolicy.buildPartitions }, (_, bucket) => ({
				snapshotId: created.id,
				bucket,
			})),
		);
		return created.id;
	});
	const snapshot = await pool.query(
		`select source_watermark from public.recommendation_snapshot where id = $1::uuid`,
		[snapshotId],
	);
	const watermark = z.coerce.date().parse(snapshot.rows[0]?.source_watermark);
	const jobs = await pool.query(
		`select bucket, state from public.recommendation_snapshot_partition
		 where snapshot_id = $1::uuid order by bucket`,
		[snapshotId],
	);
	equal(jobs.rows.length, 64, "admission must insert exactly 64 control jobs");
	for (let bucket = 0; bucket < 64; bucket++) {
		equal(jobs.rows[bucket]?.bucket, bucket);
		equal(jobs.rows[bucket]?.state, "pending");
	}

	const largeChild = childName("recommendation_unit_signal_hourly", 0);
	const siblingChild = childName("recommendation_unit_signal_hourly", 1);
	await pool.query(
		`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
		 select unit_id, $1::timestamptz - (hour_offset * interval '1 hour'), kind::recommendation_signal_kind, 1, 1
		 from unnest($2::uuid[]) as unit_id
		 cross join generate_series(1, $3::int) as hour_offset
		 cross join unnest($4::text[]) as kind`,
		[watermark, [postA, postB, workId], LargeHours, [...SignalKinds]],
	);
	await pool.query(
		`insert into public.recommendation_unit_signal_hourly (unit_id,bucket_start,kind,signal_count,weight)
		select unit_id,$1::timestamptz-interval '7 days',kind::recommendation_signal_kind,1,1
		from unnest($2::uuid[]) unit_id cross join unnest($3::text[]) kind`,
		[watermark, [postA, postB, workId], [...SignalKinds]],
	);

	await pool.query(
		`insert into public.${largeChild} (unit_id, bucket_start, kind, signal_count, weight, unit_post_id)
		 values ($1::uuid, $2::timestamptz - interval '93 hours', 'upvote', 1, 2, $1::uuid)`,
		[postA, watermark],
	);
	await pool.query(
		`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
		 values ($1::uuid, $2::timestamptz - interval '94 hours', 'upvote', 1, 0)`,
		[postA, watermark],
	);
	await pool.query(
		`insert into public.recommendation_unit_signal_hourly (unit_id, bucket_start, kind, signal_count, weight)
		 select $1::uuid, $2::timestamptz - (hour_offset * interval '1 hour'), kind::recommendation_signal_kind, 1, 1
		 from generate_series(1, $3::int) as hour_offset
		 cross join unnest($4::text[]) as kind`,
		[siblingId, watermark, SiblingHours, [...SignalKinds]],
	);
	const landed = await pool.query(
		`select format('%I.%I', n.nspname, c.relname) as value from public.recommendation_unit_signal_hourly s
		 join pg_class c on c.oid=s.tableoid join pg_namespace n on n.oid=c.relnamespace where s.unit_id = $1::uuid limit 1`,
		[postA],
	);
	equal(TextRow.parse(landed.rows[0]).value, `public.${largeChild}`);
	const siblingLanded = await pool.query(
		`select format('%I.%I', n.nspname, c.relname) as value from public.recommendation_unit_signal_hourly s
		 join pg_class c on c.oid=s.tableoid join pg_namespace n on n.oid=c.relnamespace where s.unit_id = $1::uuid limit 1`,
		[siblingId],
	);
	equal(TextRow.parse(siblingLanded.rows[0]).value, `public.${siblingChild}`);
	const positiveLarge = await pool.query(
		`select count(*)::int as n from public.${largeChild}
		 where bucket_start >= $1::timestamptz - interval '7 days'
		   and bucket_start < $1::timestamptz and weight > 0`,
		[watermark],
	);
	checked(
		CountRow.parse(positiveLarge.rows[0]).n > RecommendationPolicy.buildBatchSize,
		"large physical partition must exceed one 4096-row page",
	);
	const positiveTotal = CountRow.parse(positiveLarge.rows[0]).n;

	await pool.query(
		`insert into public.recommendation_unit_signal_hourly (unit_id,bucket_start,kind,signal_count,weight)
		select unit_id,$1::timestamptz-hour_offset*interval '1 hour',kind::recommendation_signal_kind,1,0
		from unnest($2::uuid[]) unit_id cross join generate_series(1,$3::integer) hour_offset cross join unnest($4::text[]) kind`,
		[watermark, backgroundIds, BackgroundHours, [...SignalKinds]],
	);
	await pool.query(`analyze public.${largeChild}`);
	const workerSql = `select unit_id, bucket_start, kind, weight from public.${largeChild}
		where bucket_start >= $1::timestamptz - interval '7 days'
		  and bucket_start < $1::timestamptz and weight > 0
		order by bucket_start, unit_id, kind limit 4096`;
	const forcedPositive = await explainIndexPlan(workerSql, [watermark]);
	checked(
		forcedPositive.indexes.length > 0,
		`positive-index plan missing under enable_seqscan=off: ${forcedPositive.text.slice(0, 1500)}`,
	);
	checked(
		forcedPositive.relations.every((name) => name === largeChild || name.startsWith(largeChild)),
		`positive query escaped child ${largeChild}: ${forcedPositive.relations.join(",")}`,
	);
	checked(
		!forcedPositive.nodes.includes("Append"),
		"child query must not append sibling partitions",
	);
	const naturalPositive = explainTree(
		(await pool.query(`explain (analyze, buffers, format json) ${workerSql}`, [watermark])).rows,
	);
	checked(
		naturalPositive.indexes.length > 0,
		"Sparse positive workload must have a natural indexed scan",
	);
	const positiveMs = naturalPositive.executionTime;
	checked(positiveMs !== undefined, "positive query EXPLAIN lacked Execution Time");
	timings.positiveQueryMs = positiveMs;
	const pointControl = await explainIndexPlan(
		`select snapshot_id, bucket, state, generation
		 from public.recommendation_snapshot_partition
		 where snapshot_id = $1::uuid and bucket = 0`,
		[snapshotId],
	);
	checked(
		pointControl.indexes.length > 0,
		`control-row point lookup is not an index plan: ${pointControl.text.slice(0, 1500)}`,
	);

	await rejectsCode(
		() =>
			pool.query(
				`update public.recommendation_snapshot
				 set state = 'ready', completed_at = clock_timestamp()
				 where id = $1::uuid`,
				[snapshotId],
			),
		"23514",
		"activation must require all 64 partitions done",
	);
	equal(await finalizeRecommendationSnapshot(database, snapshotId), "building");

	const claimed = await Promise.all([
		claimRecommendationPartition(database, snapshotId),
		claimRecommendationPartition(database, snapshotId),
	]);
	const first = claimed[0];
	const second = claimed[1];
	checked(first && second, "concurrent claims must both obtain a lease");
	checked(first.bucket !== second.bucket, "SKIP LOCKED must hand out different buckets");
	const byBucket = new Map(
		[first, second].map((lease) => [lease.bucket, RecommendationPartitionLeaseSchema.parse(lease)]),
	);
	const lease0 = byBucket.get(0);
	const lease1 = byBucket.get(1);
	checked(lease0 && lease1, "the two lowest pending buckets must be claimed together");
	equal(lease0.generation, 1);
	equal(lease1.generation, 1);

	await pool.query(
		`update public.recommendation_snapshot_partition
		 set lease_expires_at = clock_timestamp() - interval '1 millisecond'
		 where snapshot_id = $1::uuid and bucket = 0 and generation = $2 and lease_token = $3::uuid`,
		[snapshotId, lease0.generation, lease0.token],
	);
	const reclaimed = RecommendationPartitionLeaseSchema.parse(
		await claimRecommendationPartition(database, snapshotId),
	);
	equal(reclaimed.bucket, 0);
	checked(reclaimed.generation === lease0.generation + 1, "reclaim must advance generation");
	checked(reclaimed.token !== lease0.token, "reclaim must issue a new token");
	equal((await advanceRecommendationPartition(database, lease0)).status, "stale");
	equal((await partitionOf(snapshotId, 0)).generation, reclaimed.generation);
	equal((await partitionOf(snapshotId, 0)).scannedRows, 0n);

	await installFixtureTrigger();
	await rejectsCode(
		() => advanceRecommendationPartition(database, lease1),
		"40001",
		"injected score write must fail the batch",
	);
	const rolled = await partitionOf(snapshotId, 1);
	equal(rolled.state, "working");
	equal(rolled.generation, lease1.generation);
	equal(rolled.leaseToken, lease1.token);
	equal(rolled.scannedRows, 0n);
	equal(rolled.afterUnitId, null);
	equal(
		(await scoresOf(snapshotId)).length,
		0,
		"failed score write must not leave a checkpointed score",
	);
	await dropFixtureTrigger();
	const recovered = await advanceRecommendationPartition(database, lease1);
	equal(recovered.status, "done");
	checked(
		recovered.scannedRows > 0,
		"sibling partition must write positive scores after the trigger is removed",
	);
	equal((await partitionOf(snapshotId, 1)).state, "done");
	const siblingScores = await scoresOf(snapshotId);
	checked(siblingScores.some((row) => row.unitId === siblingId));

	const page1Started = performance.now();
	const page1 = await advanceRecommendationPartition(database, reclaimed);
	timings.page1Ms = performance.now() - page1Started;
	equal(page1.status, "advanced");
	equal(page1.scannedRows, RecommendationPolicy.buildBatchSize);
	const afterPage1 = await partitionOf(snapshotId, 0);
	equal(afterPage1.state, "pending");
	equal(afterPage1.scannedRows, BigInt(RecommendationPolicy.buildBatchSize));
	checked(afterPage1.afterBucketStart && afterPage1.afterUnitId && afterPage1.afterKind);
	const withoutSibling = (rows: { unitId: string; score: number }[]) =>
		rows.filter((row) => row.unitId !== siblingId);
	scoresMatch(
		withoutSibling(await scoresOf(snapshotId)),
		await expectedScores(largeChild, watermark, RecommendationPolicy.buildBatchSize),
	);
	equal((await advanceRecommendationPartition(database, reclaimed)).status, "stale");
	scoresMatch(
		withoutSibling(await scoresOf(snapshotId)),
		await expectedScores(largeChild, watermark, RecommendationPolicy.buildBatchSize),
	);

	const page2Lease = RecommendationPartitionLeaseSchema.parse(
		await claimRecommendationPartition(database, snapshotId),
	);
	equal(page2Lease.bucket, 0);
	checked(page2Lease.generation === reclaimed.generation + 1);
	const page2Started = performance.now();
	const page2 = await advanceRecommendationPartition(database, page2Lease);
	timings.page2Ms = performance.now() - page2Started;
	equal(page2.status, "done");
	equal(page2.scannedRows, positiveTotal - RecommendationPolicy.buildBatchSize);
	equal((await partitionOf(snapshotId, 0)).state, "done");
	equal((await partitionOf(snapshotId, 0)).scannedRows, BigInt(positiveTotal));
	equal(await finalizeRecommendationSnapshot(database, snapshotId), "building");
	const afterComplete = withoutSibling(await scoresOf(snapshotId));
	scoresMatch(afterComplete, await expectedScores(largeChild, watermark, null));
	checked(afterComplete.every((row) => [postA, postB, workId].includes(row.unitId)));

	const pointScore = await explainIndexPlan(
		`select snapshot_id, unit_id, score
		 from public.unit_best_score
		 where snapshot_id = $1::uuid and unit_id = $2::uuid`,
		[snapshotId, postA],
	);
	checked(
		pointScore.indexes.length > 0,
		`score point lookup is not an index plan: ${pointScore.text.slice(0, 1500)}`,
	);
	checked(
		!Array.from({ length: 64 }, (_, bucket) => childName("unit_best_score", bucket)).every((name) =>
			pointScore.text.includes(name),
		),
		"score point lookup must not touch every hash child",
	);

	const drainStarted = performance.now();
	const firstDrain = await drainSnapshot(snapshotId);
	timings.drainMs = performance.now() - drainStarted;
	const remaining = await pool.query(
		`select state, count(*)::int as n from public.recommendation_snapshot_partition
		 where snapshot_id = $1::uuid group by state`,
		[snapshotId],
	);
	assert.deepEqual(
		remaining.rows,
		[{ state: "done", n: 64 }],
		"every control job must finish before activation",
	);
	assertions++;
	equal(await finalizeRecommendationSnapshot(database, snapshotId), "ready");
	const ready = await pool.query(
		`select state, active from public.recommendation_snapshot where id = $1::uuid`,
		[snapshotId],
	);
	equal(ready.rows[0]?.state, "ready");
	equal(ready.rows[0]?.active, true);

	await rejectsCode(
		() =>
			pool.query(
				`insert into public.unit_best_score (snapshot_id, unit_id, unit_owner, unit_shape, score, unit_updated_at)
				 values ($1::uuid, $2::uuid, 'post', 'post', 1, clock_timestamp())`,
				[snapshotId, postC],
			),
		"23514",
		"ready scores are immutable",
	);
	await rejectsCode(
		() =>
			pool.query(
				`update public.unit_best_score set score = score + 1 where snapshot_id = $1::uuid`,
				[snapshotId],
			),
		"23514",
		"ready score updates are forbidden",
	);
	scoresMatch(
		withoutSibling(await scoresOf(snapshotId)),
		await expectedScores(largeChild, watermark, null),
	);

	const priorActive = await pool.query(
		`select id from public.recommendation_snapshot where active is true`,
	);
	equal(IdRow.parse(priorActive.rows[0]).id, snapshotId);
	const buildingId = await admitRecommendationSnapshot(database);
	checked(buildingId, "A newer current-hour generation must be admitted");
	const [building] = await database
		.select()
		.from(recommendationSnapshot)
		.where(eq(recommendationSnapshot.id, buildingId));
	checked(
		building?.sourceWatermark && building.sourceWatermark > watermark,
		"The replacement must use a newer cut",
	);

	const stillActive = await pool.query(
		`select id, state from public.recommendation_snapshot where id = $1::uuid`,
		[snapshotId],
	);
	equal(stillActive.rows[0]?.state, "ready");
	equal(
		(
			await pool.query(`select active from public.recommendation_snapshot where id = $1::uuid`, [
				snapshotId,
			])
		).rows[0]?.active,
		true,
		"prior ready snapshot must remain active while the next snapshot is building",
	);
	equal(await finalizeRecommendationSnapshot(database, buildingId), "building");
	const secondLease = await claimRecommendationPartition(database, buildingId);
	checked(secondLease);
	equal(secondLease.bucket, 0);
	const priorScores = await scoresOf(snapshotId);
	await installFixtureTrigger();
	await rejectsCode(() => advanceRecommendationPartition(database, secondLease), "40001");
	await failRecommendationPartition(
		database,
		secondLease,
		new Error("Injected second-generation failure"),
	);
	equal((await partitionOf(buildingId, 0)).scannedRows, 0n);
	equal((await partitionOf(buildingId, 0)).state, "pending");
	equal((await scoresOf(buildingId)).length, 0);
	assert.deepEqual(await scoresOf(snapshotId), priorScores);
	assertions++;
	equal(
		(
			await pool.query("select active from public.recommendation_snapshot where id=$1", [
				snapshotId,
			])
		).rows[0]?.active,
		true,
	);
	equal(await finalizeRecommendationSnapshot(database, buildingId), "building");
	await dropFixtureTrigger();
	await pool.query(
		`select pg_sleep(greatest(0,extract(epoch from (next_attempt_at-clock_timestamp())))+0.025)
		from recommendation_snapshot_partition where snapshot_id=$1::uuid and bucket=0`,
		[buildingId],
	);
	const retryLease = await claimRecommendationPartition(database, buildingId);
	checked(retryLease);
	equal(retryLease.bucket, 0);
	await advanceSameLeaseConcurrently(retryLease);
	scoresMatch(
		(await scoresOf(buildingId)).filter((row) => row.unitId !== siblingId),
		await expectedScores(largeChild, building.sourceWatermark, RecommendationPolicy.buildBatchSize),
	);
	equal(await finalizeRecommendationSnapshot(database, buildingId), "building");
	const secondDrain = await drainSnapshot(buildingId);
	const secondPartition = await partitionOf(buildingId, 0);
	equal(secondPartition.scannedRows, BigInt(RecommendationPolicy.buildBatchSize));
	equal(
		secondPartition.generation,
		3,
		"One failed claim, one full batch and an empty terminal page must each have their own lease",
	);

	equal(await finalizeRecommendationSnapshot(database, buildingId), "ready");
	equal(
		(
			await pool.query(`select active from public.recommendation_snapshot where id = $1::uuid`, [
				snapshotId,
			])
		).rows[0]?.active,
		false,
	);
	equal(
		(
			await pool.query(
				`select active, state from public.recommendation_snapshot where id = $1::uuid`,
				[buildingId],
			)
		).rows[0]?.active,
		true,
	);
	equal(
		(
			await pool.query(`select state from public.recommendation_snapshot where id = $1::uuid`, [
				buildingId,
			])
		).rows[0]?.state,
		"ready",
	);

	const repository = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-recommendation-build.ts",
		"services/main/src/services/recommendations/build-partitions.ts",
		"services/main/src/services/recommendations/policy.ts",
		"libraries/schema/src/postgres/discovery/recommendation.ts",
		"services/main/src/services/database/schema/postgres/recommendation-build.sql",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, repository)))
			.digest("hex");

	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: (
				await pool.query(
					"select version() as postgres,current_setting('default_transaction_isolation') as default_isolation",
				)
			).rows[0],
			assertions,
			firstDrain,
			secondDrain,
			secondGenerationAfterFailure: true,
			exactBatchEndsWithEmptyPage: true,
			sameLeaseConcurrentAdvanceFenced: true,
			timings,
			positiveTotal,
			zeroWeightBackgroundRows: BackgroundUnits * BackgroundHours * SignalKinds.length,
			naturalPositivePlan: JSON.parse(naturalPositive.text),
			forcedPlansAreDiagnosticsOnly: true,
			page1: page1.scannedRows,
			page2: page2.scannedRows,
			naturalPositiveNodes: naturalPositive.nodes,
			pointControlIndexes: pointControl.indexes,
			pointScoreIndexes: pointScore.indexes,
			scope:
				"native PostgreSQL qualification for snapshot partitions and activation; fixture history retained",
			untestedRuntime: [
				"dispatchRecommendationRefresh / worker tick / RECOMMENDATION_REFRESH_INTERVAL_MS",
				"purgeRecommendationData retention deletes",
				"getRecommendationHealth stale-age window",
				"recommendUnits online read path",
				"apply_recommendation_unit_signal from live events",
				"failRecommendationPartition retry/backoff to 12 failures",
				"buildDeadlineMs snapshot expiry",
				"admitRecommendationSnapshot 17-snapshot retention backpressure",
				"500_000_000-row and 3_000_000_000-row corpus cost",
			],
		}),
	);
} finally {
	try {
		if (triggerInstalled.value) await dropFixtureTrigger();
	} finally {
		await pool.end();
	}
}
