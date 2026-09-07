import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/services/database/schema/operational-durability";
import { applyOperationalPartitions } from "./operational-partitions";
import { aggregateRoutingBucket, type EventEnvelope } from "../src/services/events/envelope";
import {
	admitOperationalTask,
	appendOperationalOutbox,
	applyOperationalEvent,
	claimOperationalTask,
	completeOperationalTask,
	OperationalIdentityConflict,
	OperationalLeaseLost,
	renewOperationalTask,
	retryOperationalTask,
	type TaskIdentity,
} from "../src/services/events/durability";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable PostgreSQL target required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== "/rezics_atlas_durability"
)
	throw new Error("Use loopback rezics_atlas_durability only");
const pool = new Pool({ connectionString, max: 8, statement_timeout: 10000 });
const db = drizzle({ client: pool });
let assertions = 0;
function checked(condition: unknown): asserts condition {
	assert.ok(condition);
	assertions++;
}
async function rejectsConstraint(work: () => Promise<unknown>): Promise<void> {
	await assert.rejects(
		work,
		(error: unknown) =>
			typeof error === "object" && error !== null && "code" in error && error.code === "23514",
	);
	assertions++;
}
const aggregate = { owner: "qualification", key: "durability", revision: "1" };
const bucket = aggregateRoutingBucket(aggregate.owner, aggregate.key);
function message(task = true): EventEnvelope {
	return {
		version: 1,
		messageId: randomUUID(),
		class: task ? "task" : "event",
		kind: task ? "qualification.execute" : "qualification.changed",
		occurredAt: new Date().toISOString(),
		correlationId: null,
		causationId: null,
		routingEpoch: 1,
		routingBucket: bucket,
		aggregate,
		payload: task
			? {
					operationId: randomUUID(),
					consumerKey: "qualification.g1",
					maximumAttempts: 3,
					deadline: new Date(Date.now() + 3600000).toISOString(),
				}
			: { value: 1 },
	};
}
async function claim(identity: TaskIdentity, milliseconds = 60000) {
	const result = await db.transaction((tx) => claimOperationalTask(tx, identity, milliseconds));
	assert.equal(result.status, "claimed");
	if (result.status !== "claimed") throw new Error("Claim expected");
	return result.lease;
}
try {
	const occupied = await pool.query("select to_regclass('public.operational_outbox') as existing");
	assert.equal(occupied.rows[0]?.existing, null, "Harness requires an empty disposable target");
	const statements = applyOperationalPartitions(
		await generateMigration(await generateDrizzleJson({}), await generateDrizzleJson(schema)),
	);
	await pool.query(statements.join("\n"));
	await pool.query(
		await readFile(
			new URL(
				"../src/services/database/schema/postgres/operational-durability.sql",
				import.meta.url,
			),
			"utf8",
		),
	);
	await pool.query("create table public.operational_qualification_effect (id uuid primary key)");
	await pool.query(
		"insert into public.operational_capacity(routing_bucket,lane,maximum_rows,maximum_bytes) select $1,lane,100000,1000000000 from unnest(array['event-outbox','task-outbox','task-intent','receipt']) as lane",
		[bucket],
	);
	checked(
		(
			await pool.query(
				"select count(*)::int as n from pg_inherits i join pg_class p on p.oid=i.inhparent where p.relname in ('operational_outbox','operational_task_intent','operational_application_receipt')",
			)
		).rows[0]?.n === 192,
	);

	const original = message();
	const identities = await Promise.all(
		Array.from({ length: 8 }, () => db.transaction((tx) => admitOperationalTask(tx, original))),
	);
	const identity = identities[0];
	if (!identity) throw new Error("Identity absent");
	checked(
		(await pool.query("select count(*)::int n from operational_task_intent")).rows[0]?.n === 1,
	);
	checked(
		(
			await pool.query(
				"select reserved_rows::int n from operational_capacity where routing_bucket=$1 and lane='receipt'",
				[bucket],
			)
		).rows[0]?.n === 1,
	);
	await assert.rejects(
		() =>
			db.transaction((tx) =>
				admitOperationalTask(tx, {
					...original,
					payload: { ...original.payload, maximumAttempts: 2 },
				}),
			),
		OperationalIdentityConflict,
	);
	assertions++;
	const claimed = await Promise.all(
		Array.from({ length: 8 }, () =>
			db.transaction((tx) => claimOperationalTask(tx, identity, 60000)),
		),
	);
	checked(claimed.filter((x) => x.status === "claimed").length === 1);
	checked(claimed.filter((x) => x.status === "busy").length === 7);
	const first = claimed.find((x) => x.status === "claimed");
	if (!first || first.status !== "claimed") throw new Error("Claim absent");
	await pool.query(
		"update operational_task_intent set lease_expires_at=clock_timestamp()-interval '1 second' where routing_bucket=$1 and operation_id=$2",
		[bucket, identity.operationId],
	);
	await assert.rejects(
		() => db.transaction((tx) => renewOperationalTask(tx, first.lease, 60000)),
		OperationalLeaseLost,
	);
	assertions++;
	const second = await claim(identity);
	checked(second.fencingGeneration === first.lease.fencingGeneration + 1n);
	await assert.rejects(
		() =>
			db.transaction((tx) =>
				completeOperationalTask(tx, first.lease, "succeeded", "stale", async () => {}),
			),
		OperationalLeaseLost,
	);
	assertions++;
	await assert.rejects(
		() => db.transaction((tx) => retryOperationalTask(tx, first.lease, 1, "stale")),
		OperationalLeaseLost,
	);
	assertions++;
	const effect = randomUUID();
	await db.transaction((tx) =>
		completeOperationalTask(tx, second, "succeeded", "applied", async (inner) => {
			await inner.execute(sql`insert into operational_qualification_effect(id) values (${effect})`);
			await appendOperationalOutbox(inner, [message(false)]);
		}),
	);
	checked(
		(await db.transaction((tx) => claimOperationalTask(tx, identity, 60000))).status === "terminal",
	);
	checked(
		(
			await pool.query("select count(*)::int n from operational_qualification_effect where id=$1", [
				effect,
			])
		).rows[0]?.n === 1,
	);

	const lateIdentity = await db.transaction((tx) => admitOperationalTask(tx, message()));
	const lateLease = await claim(lateIdentity, 50);
	const rolledEffect = randomUUID();
	await db.transaction(async (tx) => {
		await assert.rejects(
			() =>
				completeOperationalTask(tx, lateLease, "succeeded", "late", async (inner) => {
					await inner.execute(
						sql`insert into operational_qualification_effect(id) values (${rolledEffect})`,
					);
					await appendOperationalOutbox(inner, [message(false)]);
					await inner.execute(sql`select pg_sleep(0.075)`);
				}),
			OperationalLeaseLost,
		);
		assertions++;
	});
	checked(
		(
			await pool.query("select count(*)::int n from operational_qualification_effect where id=$1", [
				rolledEffect,
			])
		).rows[0]?.n === 0,
	);
	checked(
		(
			await pool.query(
				"select count(*)::int n from operational_application_receipt where operation_id=$1",
				[lateIdentity.operationId],
			)
		).rows[0]?.n === 0,
	);

	const retryIdentity = await db.transaction((tx) => admitOperationalTask(tx, message()));
	const retryLease = await claim(retryIdentity);
	checked(
		(await db.transaction((tx) => retryOperationalTask(tx, retryLease, 60000, "temporary")))
			.status === "retry",
	);
	checked(
		(await db.transaction((tx) => claimOperationalTask(tx, retryIdentity, 60000))).status ===
			"deferred",
	);
	await assert.rejects(
		() => db.transaction((tx) => renewOperationalTask(tx, retryLease, 60000)),
		OperationalLeaseLost,
	);
	assertions++;
	const oneAttempt = message();
	oneAttempt.payload.maximumAttempts = 1;
	const lastIdentity = await db.transaction((tx) => admitOperationalTask(tx, oneAttempt));
	const lastLease = await claim(lastIdentity);
	checked(
		(await db.transaction((tx) => retryOperationalTask(tx, lastLease, 1, "permanent"))).status ===
			"terminal",
	);
	checked(
		(await db.transaction((tx) => claimOperationalTask(tx, lastIdentity, 60000))).status ===
			"terminal",
	);

	const expiring = message();
	expiring.payload.deadline = new Date(Date.now() + 200).toISOString();
	const expiringIdentity = await db.transaction((tx) => admitOperationalTask(tx, expiring));
	const acquired = Promise.withResolvers<void>();
	const locker = db.transaction(async (tx) => {
		await tx.execute(
			sql`select operation_id from operational_task_intent where routing_bucket=${bucket} and operation_id=${expiringIdentity.operationId} for update`,
		);
		acquired.resolve();
		await tx.execute(sql`select pg_sleep(0.3)`);
	});
	await acquired.promise;
	const waitingClaim = db.transaction((tx) => claimOperationalTask(tx, expiringIdentity, 60000));
	await locker;
	checked((await waitingClaim).status === "terminal");

	const eventIdentity = { ...identity, operationId: randomUUID() };
	const eventEffect = randomUUID();
	const results = await Promise.all(
		Array.from({ length: 8 }, () =>
			db.transaction((tx) =>
				applyOperationalEvent(tx, eventIdentity, async (inner) => {
					await inner.execute(
						sql`insert into operational_qualification_effect(id) values (${eventEffect})`,
					);
				}),
			),
		),
	);
	checked(results.filter((x) => x.status === "committed").length === 1);
	checked(results.filter((x) => x.status === "duplicate").length === 7);
	const beforeRollback = await pool.query(
		"select lane,reserved_rows,reserved_bytes from operational_capacity order by lane",
	);
	await assert.rejects(() =>
		db.transaction(async (tx) => {
			await admitOperationalTask(tx, message());
			throw new Error("rollback fixture");
		}),
	);
	assertions++;
	assert.deepEqual(
		(
			await pool.query(
				"select lane,reserved_rows,reserved_bytes from operational_capacity order by lane",
			)
		).rows,
		beforeRollback.rows,
	);
	assertions++;

	const template = message(false);
	await db.transaction((tx) => appendOperationalOutbox(tx, [template]));
	for (const field of [
		"version",
		"messageId",
		"class",
		"kind",
		"routingBucket",
		"routingEpoch",
		"aggregate",
		"occurredAt",
	]) {
		await rejectsConstraint(() =>
			pool.query(
				`insert into operational_outbox select routing_bucket,$2::uuid,message_class,kind,routing_epoch,subject,aggregate_key,occurred_at,(payload||jsonb_build_object('messageId',$2::text))-$3,((payload||jsonb_build_object('messageId',$2::text))-$3)::text,created_at from operational_outbox where routing_bucket=$1 and message_id=$4`,
				[bucket, randomUUID(), field, template.messageId],
			),
		);
	}
	await rejectsConstraint(() =>
		pool.query(
			`insert into operational_outbox select routing_bucket,$2::uuid,message_class,kind,routing_epoch,'wrong.subject',aggregate_key,occurred_at,payload||jsonb_build_object('messageId',$2::text),(payload||jsonb_build_object('messageId',$2::text))::text,created_at from operational_outbox where routing_bucket=$1 and message_id=$3`,
			[bucket, randomUUID(), template.messageId],
		),
	);
	await rejectsConstraint(() =>
		pool.query(
			`insert into operational_task_intent(routing_bucket,operation_id,consumer_key,request_fingerprint,origin_message_id,maximum_attempts,deadline) select routing_bucket,$2::uuid,consumer_key,request_fingerprint,origin_message_id,maximum_attempts,deadline from operational_task_intent where routing_bucket=$1 and operation_id=$3`,
			[bucket, randomUUID(), identity.operationId],
		),
	);
	const precise = message(false);
	precise.occurredAt = "2026-09-07T00:00:00.123456Z";
	await db.transaction((tx) => appendOperationalOutbox(tx, [precise]));
	assertions++;
	await assert.rejects(() =>
		pool.query(
			"update operational_outbox set kind='other' where routing_bucket=$1 and message_id=$2",
			[bucket, template.messageId],
		),
	);
	assertions++;
	await assert.rejects(() =>
		pool.query(
			"update operational_application_receipt set detail='changed' where routing_bucket=$1 and operation_id=$2",
			[bucket, identity.operationId],
		),
	);
	assertions++;
	await pool.query(
		"update operational_capacity set maximum_rows=reserved_rows where routing_bucket=$1 and lane='event-outbox'",
		[bucket],
	);
	await assert.rejects(() => db.transaction((tx) => appendOperationalOutbox(tx, [message(false)])));
	assertions++;
	// Already admitted task still completes despite a full outbox lane and reserved receipt lane.
	await pool.query(
		"update operational_capacity set maximum_rows=reserved_rows where routing_bucket=$1 and lane='receipt'",
		[bucket],
	);
	const recovered = await claim(lateIdentity);
	await db.transaction((tx) =>
		completeOperationalTask(tx, recovered, "cancelled", "cancelled", async () => {}),
	);
	assertions++;
	const plan = await pool.query(
		"explain (analyze,buffers,format json) select * from operational_task_intent where routing_bucket=$1 and operation_id=$2 for update",
		[bucket, identity.operationId],
	);
	const planText = JSON.stringify(plan.rows);
	checked(
		planText.includes(
			`operational_task_intent_p${String(Math.floor(bucket / 16)).padStart(2, "0")}`,
		),
	);
	checked(!planText.includes('"Node Type":"Append"'));
	console.info(
		JSON.stringify({
			assertions,
			partitions: 192,
			bucket,
			exactLookupPlan: plan.rows,
			scope: "disposable PostgreSQL transactional/race evidence; not throughput qualification",
		}),
	);
} finally {
	await pool.end();
}
