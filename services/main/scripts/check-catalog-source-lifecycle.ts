import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";
import { users } from "../src/services/database/schema/auth";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
	catalogSourceBindingRevision,
} from "../src/services/database/schema/catalog-source";
import {
	createCatalogIdentity,
	addCatalogName,
	loadCatalogIdentity,
} from "../src/services/catalog/storage";
import {
	beginCatalogSourceAcquisition,
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	loadCatalogSourceReceipt,
	readCatalogSourceBytes,
	loadCatalogSourceDocument,
	recordCatalogSourceDocument,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import {
	bindCatalogSourceIdentity,
	reviseCatalogSourceBinding,
} from "../src/services/catalog/source-bindings";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable source-lifecycle fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)
)
	throw new Error("Source lifecycle checks require an isolated loopback rezics_atlas target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = objects.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const rollback = new Error("rollback source lifecycle fixture");
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Source lifecycle fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning();
			assert.ok(actor);
			const key = {
				source: "vndb",
				objectType: "vn",
				externalId: `fixture-${crypto.randomUUID()}`,
			};
			const firstBytes = Buffer.from('{"value":"first"}');
			const bucket = aggregateRoutingBucket("source_record", catalogSourceRecordId(key));
			await tx.insert(operationalCapacity).values(
				["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
					routingBucket: bucket,
					lane,
					maximumRows: 1000n,
					maximumBytes: 64_000_000n,
				})),
			);
			const first = await recordCatalogSourceObservation(
				tx,
				await storeCatalogSourcePayload(key, firstBytes, "a".repeat(64), null, archive),
			);
			const native = await createCatalogIdentity(
				tx,
				{ owner: "reference", shape: "source-fixture" },
				actor.id,
			);
			const binding = await bindCatalogSourceIdentity(tx, actor.id, {
				sourceRecordId: first.record.id,
				path: "/",
				snapshotId: first.snapshot.id,
				reference: native,
			});
			const old = await beginCatalogSourceAcquisition(tx, key);
			const latest = await beginCatalogSourceAcquisition(tx, key);
			const stale = await storeCatalogSourcePayload(
				key,
				Buffer.from('{"value":"stale"}'),
				"a".repeat(64),
				null,
				archive,
				old,
			);
			await assert.rejects(
				tx.transaction((nested) => recordCatalogSourceObservation(nested, stale)),
				/generation is stale/u,
			);
			const newestBytes = Buffer.from('{"value":"latest"}');
			const newest = await recordCatalogSourceObservation(
				tx,
				await storeCatalogSourcePayload(key, newestBytes, "a".repeat(64), null, archive, latest),
			);
			const reopened = await loadCatalogSourceReceipt(
				tx,
				first.record.id,
				newest.snapshot.id,
				archive,
			);
			assert.deepEqual(Buffer.from(await readCatalogSourceBytes(reopened)), newestBytes);
			const reopenedDocument = await loadCatalogSourceDocument(
				tx,
				first.record.id,
				newest.snapshot.id,
				reopened,
				newestBytes,
			);
			assert.equal(reopenedDocument.referenceAt("/value").externalId, "latest");
			const oldReceipt = await loadCatalogSourceReceipt(
				tx,
				first.record.id,
				first.snapshot.id,
				archive,
			);
			const oldDocument = await loadCatalogSourceDocument(
				tx,
				first.record.id,
				first.snapshot.id,
				oldReceipt,
				firstBytes,
			);
			assert.equal(oldDocument.referenceAt("/value").externalId, "first");
			assert.equal(oldDocument.record.headSnapshotId, newest.snapshot.id);
			const reusedDocument = await recordCatalogSourceDocument(tx, oldReceipt, firstBytes);
			assert.equal(reusedDocument.snapshot.id, first.snapshot.id);
			assert.equal(reusedDocument.record.headSnapshotId, newest.snapshot.id);
			await assert.rejects(
				loadCatalogSourceDocument(tx, first.record.id, newest.snapshot.id, oldReceipt, firstBytes),
				/exact committed snapshot/u,
			);
			const proposalInput = {
				sourceRecordId: first.record.id,
				mappingKey: binding.mappingKey,
				snapshotId: newest.snapshot.id,
				mappingVersion: "vndb.vn.1",
			};
			const proposed = await proposeCatalogSourceAdoption(tx, actor.id, proposalInput);
			assert.equal(proposed.status, "proposed");
			if (proposed.status !== "proposed") throw new Error("Expected initial proposal");
			const bindingKey = { sourceRecordId: first.record.id, mappingKey: binding.mappingKey };
			await reviseCatalogSourceBinding(tx, actor.id, {
				...bindingKey,
				expectedRevision: 1,
				state: "paused",
				mode: "review",
				reason: "Pause race fixture",
			});
			let calls = 0;
			const decision = {
				sourceRecordId: first.record.id,
				proposalId: proposed.proposal.id,
				mappingVersion: "vndb.vn.1",
				action: "apply" as const,
				reason: "Reviewed fixture",
			};
			const staleDecision = await decideCatalogSourceProposal(tx, actor.id, decision, async () => {
				calls++;
				return { revision: 2 };
			});
			assert.equal(staleDecision.status, "superseded");
			assert.equal(calls, 0);
			await reviseCatalogSourceBinding(tx, actor.id, {
				...bindingKey,
				expectedRevision: 2,
				state: "active",
				mode: "review",
				reason: "Resume fixture",
			});
			const resumed = await proposeCatalogSourceAdoption(tx, actor.id, proposalInput);
			assert.equal(resumed.status, "proposed");
			if (resumed.status !== "proposed") throw new Error("Expected resumed proposal");
			const apply = { ...decision, proposalId: resumed.proposal.id };
			const abortedApply = new Error("Abort the native source command before publication");
			await assert.rejects(
				tx.transaction((nested) =>
					decideCatalogSourceProposal(nested, actor.id, apply, async (applying, context) => {
						await addCatalogName(
							applying,
							context.reference,
							context.actor,
							context.expectedRevision,
							{ kind: "source-primary", languageTag: null, value: "Rolled-back source value" },
						);
						throw abortedApply;
					}),
				),
				(error: unknown) => error === abortedApply,
			);
			assert.equal((await loadCatalogIdentity(tx, native, actor.id, true)).revision, 1);
			const applied = await decideCatalogSourceProposal(
				tx,
				actor.id,
				apply,
				async (nested, context) => {
					calls++;
					return addCatalogName(
						nested,
						context.reference,
						context.actor,
						context.expectedRevision,
						{ kind: "source-primary", languageTag: null, value: "Adopted value" },
					);
				},
			);
			assert.equal(applied.status, "applied");
			assert.equal(calls, 1);
			const repeated = await decideCatalogSourceProposal(tx, actor.id, apply, async () => {
				throw new Error("Duplicate must not mutate");
			});
			assert.equal(repeated.status, "repeated");
			await addCatalogName(tx, native, actor.id, 2, {
				kind: "alias",
				languageTag: null,
				value: "Independent human edit",
			});
			await assert.rejects(
				tx.transaction((nested) =>
					decideCatalogSourceProposal(
						nested,
						actor.id,
						{ ...apply, action: "withdraw" },
						async () => ({ revision: 4 }),
					),
				),
				/independent native edits/u,
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(catalogSourceSnapshot)
						.set({ sourceRevision: "rewritten" })
						.where(
							and(
								eq(catalogSourceSnapshot.sourceRecordId, first.record.id),
								eq(catalogSourceSnapshot.id, newest.snapshot.id),
							),
						),
				),
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(catalogSourceBindingRevision)
						.set({ reason: "rewrite" })
						.where(
							and(
								eq(catalogSourceBindingRevision.sourceRecordId, first.record.id),
								eq(catalogSourceBindingRevision.mappingKey, binding.mappingKey),
							),
						),
				),
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(catalogSourceRecord)
						.set({ acquisitionGeneration: 0 })
						.where(eq(catalogSourceRecord.id, first.record.id)),
				),
			);
			await tx.execute(sql`set constraints all immediate`);
			const plan = await tx.execute(
				sql`explain (format json) select id from public.catalog_source_record where id = ${first.record.id}::uuid`,
			);
			assert.ok(plan.rows.length > 0);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		"Source lifecycle passed: late acquisition, archived replay, pause/resume fences, exactly-once native apply, protected withdrawal, immutable evidence and committed binding heads.",
	);
} finally {
	await pool.end();
}
