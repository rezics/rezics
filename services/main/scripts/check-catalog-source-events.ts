import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { CatalogSourceArchive } from "../src/services/catalog/source-observations";
import {
	createSourceObservationEvent,
	parseSourceObservationEvent,
} from "../src/services/catalog/source-events";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
} from "../src/services/database/schema/catalog-source";
import {
	operationalCapacity,
	operationalOutbox,
} from "../src/services/database/schema/operational-durability";
import { aggregateRoutingBucket, envelopeSubject } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable PostgreSQL fixture configuration is required");
const url = new URL(connectionString);
if (
	!["postgres:", "postgresql:"].includes(url.protocol) ||
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname) ||
	url.search !== "" ||
	url.hash !== ""
)
	throw new Error(
		"Source event acceptance requires explicit loopback rezics_atlas[_suffix] without connection overrides",
	);

const { recordCatalogSourceObservation, readCatalogSourceBytes, storeCatalogSourcePayload } =
	await import("../src/services/catalog/source-observations");
const payloads = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		payloads.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const bytes = payloads.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const fixtureRun = randomUUID();
const sourceKey = { source: "qualification", objectType: "source_event", externalId: fixtureRun };
const recordId = catalogSourceRecordId(sourceKey);
const bucket = aggregateRoutingBucket("source_record", recordId);
const missingKey = { ...sourceKey, externalId: `${fixtureRun}-missing` };
const contractSha256 = "c".repeat(64);
const firstBytes = Buffer.from(JSON.stringify({ title: "Source event fixture", revision: 1 }));
const changedBytes = Buffer.from(
	JSON.stringify({ title: "Changed source event fixture", revision: 2 }),
);
const firstReceipt = await storeCatalogSourcePayload(
	sourceKey,
	firstBytes,
	contractSha256,
	"1",
	archive,
);
const changedReceipt = await storeCatalogSourcePayload(
	sourceKey,
	changedBytes,
	contractSha256,
	"2",
	archive,
);
const missingReceipt = await storeCatalogSourcePayload(
	missingKey,
	firstBytes,
	contractSha256,
	"1",
	archive,
);
assert.deepEqual(Buffer.from(await readCatalogSourceBytes(firstReceipt)), firstBytes);

const pool = new Pool({
	connectionString,
	max: 1,
	statement_timeout: 10_000,
	connectionTimeoutMillis: 5_000,
});
const database = drizzle({ client: pool });
const rollback = new Error("Rollback all source event acceptance fixtures");
const restoreMissingLane = new Error("Restore the fixture capacity savepoint");
const capacityKey = and(
	eq(operationalCapacity.routingBucket, bucket),
	eq(operationalCapacity.lane, "event-outbox"),
);
const sourceRecordKey = eq(catalogSourceRecord.id, recordId);
const snapshotKey = eq(catalogSourceSnapshot.sourceRecordId, recordId);
const missingSourceKey = and(
	eq(catalogSourceRecord.source, missingKey.source),
	eq(catalogSourceRecord.objectType, missingKey.objectType),
	eq(catalogSourceRecord.externalId, missingKey.externalId),
);
const messageIds: string[] = [];
const checks: string[] = [];

function hasPostgresCode(error: unknown, code: string): boolean {
	let current = error;
	for (let depth = 0; depth < 8 && current !== null && typeof current === "object"; depth++) {
		if ("code" in current && current.code === code) return true;
		current = "cause" in current ? current.cause : undefined;
	}
	return false;
}

try {
	assert.equal(
		(await database.select().from(catalogSourceRecord).where(sourceRecordKey).limit(1)).length,
		0,
		"Fixed fixture source ID is occupied",
	);
	assert.equal(
		(await database.select().from(operationalCapacity).where(capacityKey).limit(1)).length,
		0,
		"Fixture capacity lane is occupied; use a separate migrated target",
	);
	try {
		await database.transaction(async (tx) => {
			// Run before provisioning a fixture lane. If another lane happens to admit
			// this generated owner, the assertion fails and rolls the whole harness back.
			await assert.rejects(
				() => recordCatalogSourceObservation(tx, missingReceipt),
				(error: unknown) => hasPostgresCode(error, "53000"),
			);
			assert.equal(
				(await tx.select().from(catalogSourceRecord).where(missingSourceKey).limit(1)).length,
				0,
				"Caught admission failure leaked a newly registered source record",
			);
			checks.push("caught-new-source-admission-rolls-back-registration");

			await tx.insert(operationalCapacity).values({
				routingBucket: bucket,
				lane: "event-outbox",
				maximumRows: 8n,
				maximumBytes: 1_048_576n,
			});
			await tx.insert(catalogSourceRecord).values({ id: recordId, ...sourceKey });
			const first = await recordCatalogSourceObservation(tx, firstReceipt);
			messageIds.push(first.snapshot.id);
			assert.equal(first.repeated, false);
			assert.equal(first.record.id, recordId);
			const expectedEvent = createSourceObservationEvent(first.snapshot);
			const outboxKey = and(
				eq(operationalOutbox.routingBucket, bucket),
				eq(operationalOutbox.messageId, first.snapshot.id),
			);
			const [storedEvent] = await tx.select().from(operationalOutbox).where(outboxKey).limit(1);
			assert.ok(storedEvent);
			assert.deepEqual(storedEvent.payload, expectedEvent);
			assert.deepEqual(JSON.parse(storedEvent.serializedEnvelope), expectedEvent);
			assert.equal(storedEvent.subject, envelopeSubject(expectedEvent));
			assert.deepEqual(parseSourceObservationEvent(storedEvent.payload).payload, {
				sourceRecordId: recordId,
				snapshotId: first.snapshot.id,
				contentSha256: firstReceipt.contentSha256,
				contractSha256,
			});
			const [capacityAfterFirst] = await tx
				.select()
				.from(operationalCapacity)
				.where(capacityKey)
				.limit(1);
			assert.ok(capacityAfterFirst);
			assert.equal(capacityAfterFirst.reservedRows, 1n);
			checks.push("exact-snapshot-and-outbox-reference-share-transaction");

			const repeated = await recordCatalogSourceObservation(tx, firstReceipt);
			assert.equal(repeated.repeated, true);
			assert.equal(repeated.snapshot.id, first.snapshot.id);
			assert.equal(
				(await tx.select().from(catalogSourceSnapshot).where(snapshotKey).limit(3)).length,
				1,
			);
			assert.deepEqual(
				(await tx.select().from(operationalCapacity).where(capacityKey).limit(1))[0],
				capacityAfterFirst,
			);
			checks.push("repeat-reuses-snapshot-and-reserves-no-extra-event");

			await tx.update(operationalCapacity).set({ maximumRows: 1n }).where(capacityKey);
			await assert.rejects(
				() => recordCatalogSourceObservation(tx, changedReceipt),
				(error: unknown) => hasPostgresCode(error, "53000"),
			);
			assert.equal(
				(await tx.select().from(catalogSourceSnapshot).where(snapshotKey).limit(3)).length,
				1,
				"Caught capacity error leaked an immutable snapshot",
			);
			assert.equal(
				(await tx.select().from(operationalCapacity).where(capacityKey).limit(1))[0]?.reservedRows,
				1n,
			);
			checks.push("caught-full-lane-rolls-back-snapshot-and-reservation");

			const beforeOutcome = (
				await tx.select().from(catalogSourceRecord).where(sourceRecordKey).limit(1)
			)[0]?.lastCheckOutcome;
			await assert.rejects(
				() =>
					tx.transaction(async (nested) => {
						await nested
							.update(catalogSourceRecord)
							.set({ lastCheckOutcome: "error" })
							.where(sourceRecordKey);
						await recordCatalogSourceObservation(nested, changedReceipt);
					}),
				(error: unknown) => hasPostgresCode(error, "53000"),
			);
			assert.equal(
				(await tx.select().from(catalogSourceRecord).where(sourceRecordKey).limit(1))[0]
					?.lastCheckOutcome,
				beforeOutcome,
			);
			assert.equal(
				(await tx.select().from(catalogSourceSnapshot).where(snapshotKey).limit(3)).length,
				1,
			);
			checks.push("enclosing-source-mutation-and-snapshot-rollback-together");

			try {
				await tx.transaction(async (nested) => {
					await nested.delete(operationalCapacity).where(capacityKey);
					await assert.rejects(
						() => recordCatalogSourceObservation(nested, changedReceipt),
						(error: unknown) => hasPostgresCode(error, "53000"),
					);
					assert.equal(
						(await nested.select().from(catalogSourceSnapshot).where(snapshotKey).limit(3)).length,
						1,
					);
					throw restoreMissingLane;
				});
			} catch (error: unknown) {
				if (error !== restoreMissingLane) throw error;
			}
			checks.push("caught-missing-lane-rolls-back-snapshot");

			await tx.update(operationalCapacity).set({ maximumRows: 8n }).where(capacityKey);
			const changed = await recordCatalogSourceObservation(tx, changedReceipt);
			messageIds.push(changed.snapshot.id);
			assert.equal(changed.repeated, false);
			assert.notEqual(changed.snapshot.id, first.snapshot.id);
			assert.equal(
				(await tx.select().from(catalogSourceSnapshot).where(snapshotKey).limit(3)).length,
				2,
			);
			assert.equal(
				(await tx.select().from(operationalCapacity).where(capacityKey).limit(1))[0]?.reservedRows,
				2n,
			);
			const [changedEvent] = await tx
				.select()
				.from(operationalOutbox)
				.where(
					and(
						eq(operationalOutbox.routingBucket, bucket),
						eq(operationalOutbox.messageId, changed.snapshot.id),
					),
				)
				.limit(1);
			assert.ok(changedEvent);
			assert.deepEqual(changedEvent.payload, createSourceObservationEvent(changed.snapshot));
			checks.push("changed-source-emits-another-exact-snapshot-event");

			await assert.rejects(
				() =>
					tx.transaction((nested) =>
						nested
							.update(operationalOutbox)
							.set({ kind: "qualification.changed" })
							.where(outboxKey),
					),
				(error: unknown) => hasPostgresCode(error, "23514"),
			);
			await assert.rejects(
				() =>
					tx.transaction((nested) =>
						nested
							.update(catalogSourceSnapshot)
							.set({ contentSha256: "d".repeat(64) })
							.where(and(snapshotKey, eq(catalogSourceSnapshot.id, first.snapshot.id))),
					),
				(error: unknown) => hasPostgresCode(error, "23514"),
			);
			assert.deepEqual(
				(await tx.select().from(operationalOutbox).where(outboxKey).limit(1))[0]?.payload,
				expectedEvent,
			);
			assert.throws(
				() => parseSourceObservationEvent({ ...expectedEvent, messageId: changed.snapshot.id }),
				/exact snapshot reference/u,
			);
			assert.throws(
				() =>
					parseSourceObservationEvent({
						...expectedEvent,
						payload: { ...expectedEvent.payload, sourceRecordId: randomUUID() },
					}),
				/exact snapshot reference/u,
			);
			assert.throws(() =>
				parseSourceObservationEvent({
					...expectedEvent,
					payload: { ...expectedEvent.payload, raw: { title: "unexpected" } },
				}),
			);
			checks.push("immutable-evidence-and-mismatched-reference-rejection");
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	assert.equal(
		(await database.select().from(catalogSourceRecord).where(sourceRecordKey).limit(1)).length,
		0,
	);
	assert.equal(
		(await database.select().from(catalogSourceRecord).where(missingSourceKey).limit(1)).length,
		0,
	);
	assert.equal(
		(await database.select().from(catalogSourceSnapshot).where(snapshotKey).limit(1)).length,
		0,
	);
	assert.equal(
		(await database.select().from(operationalCapacity).where(capacityKey).limit(1)).length,
		0,
	);
	assert.equal(messageIds.length, 2);
	for (const messageId of messageIds)
		assert.equal(
			(
				await database
					.select()
					.from(operationalOutbox)
					.where(
						and(
							eq(operationalOutbox.routingBucket, bucket),
							eq(operationalOutbox.messageId, messageId),
						),
					)
					.limit(1)
			).length,
			0,
		);
	checks.push("transaction-failure-leaves-no-fixture-record-snapshot-event-or-capacity");
	console.info(
		JSON.stringify(
			{
				status: "passed",
				bucket,
				checks,
				scope:
					"Real PostgreSQL transactional acceptance; all fixture writes rolled back. Memory archive; no broker publication or business-subscriber qualification.",
			},
			null,
			2,
		),
	);
} finally {
	await pool.end();
	payloads.clear();
}
