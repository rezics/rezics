import assert from "node:assert/strict";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { softwareRecordSourceOccurrence } from "../src/services/database/schema/catalog-software-source";
import {
	catalogSourceMappingClaim,
	catalogSourceAdoptionProposal,
} from "../src/services/database/schema/catalog-source";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import {
	catalogSourceApplication,
	softwareSourceRecordApplicationChange,
} from "../src/services/database/schema/catalog-source-application";
import {
	catalogSourceRecordId,
	recordCatalogSourceObservation,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	createNativeSoftwareContent,
	SoftwareContentDetailsSchema,
	reviseSoftwareContent,
	restoreSoftwareDetails,
} from "../src/services/catalog/software";
import { bindCatalogSourceIdentity } from "../src/services/catalog/source-bindings";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable database required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)
)
	throw new Error("Application checks require isolated loopback rezics_atlas");
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
const rollback = new Error("rollback native source application fixture");
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Source application fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning();
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				const key = {
					source: "vndb",
					objectType: "vn",
					externalId: `application-${crypto.randomUUID()}`,
				};
				const routingBucket = aggregateRoutingBucket("source_record", catalogSourceRecordId(key));
				await tx.insert(operationalCapacity).values(
					["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
						routingBucket,
						lane,
						maximumRows: 1000n,
						maximumBytes: 64_000_000n,
					})),
				);
				const first = await recordCatalogSourceObservation(
					tx,
					await storeCatalogSourcePayload(
						key,
						Buffer.from('{"description":"initial"}'),
						"a".repeat(64),
						null,
						archive,
					),
				);
				const native = await createNativeSoftwareContent(tx, actor.id, {
					name: { value: "Application fixture", languageTag: null },
					details: { description: "initial" },
				});
				const binding = await bindCatalogSourceIdentity(tx, actor.id, {
					mappingVersion: "native.fixture.1",
					sourceRecordId: first.record.id,
					path: "/",
					snapshotId: first.snapshot.id,
					reference: native,
				});
				await tx.insert(softwareRecordSourceOccurrence).values({
					sourceShape: "content",
					sourceValue: SoftwareContentDetailsSchema.parse({ description: "initial" }),
					mappingKey: binding.mappingKey,
					correspondenceRevision: 1,
					sourceRecordId: first.record.id,
					snapshotId: first.snapshot.id,
					ownerId: native.id,
					revision: 1,
					sourcePath: "/description",
				});
				const second = await recordCatalogSourceObservation(
					tx,
					await storeCatalogSourcePayload(
						key,
						Buffer.from('{"description":"updated"}'),
						"a".repeat(64),
						null,
						archive,
					),
				);
				const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
					sourceRecordId: first.record.id,
					mappingKey: binding.mappingKey,
					snapshotId: second.snapshot.id,
					mappingVersion: "native.fixture.1",
				});
				assert.equal(proposal.status, "proposed");
				if (proposal.status !== "proposed") throw new Error("Expected source proposal");
				const decision = {
					sourceRecordId: first.record.id,
					proposalId: proposal.proposal.id,
					mappingVersion: "native.fixture.1",
					action: "apply" as const,
					reason: "Reviewed native fixture",
				};
				const applied = await decideCatalogSourceProposal(
					tx,
					actor.id,
					decision,
					async (nested, context) => {
						assert.equal(context.previousSnapshotId, first.snapshot.id);
						assert.equal(context.action, "apply");
						const result = await reviseSoftwareContent(
							nested,
							context.reference,
							context.actor,
							context.expectedRevision,
							{ description: "updated" },
						);
						await nested.insert(softwareRecordSourceOccurrence).values({
							sourceShape: "content",
							sourceValue: SoftwareContentDetailsSchema.parse({ description: "updated" }),
							mappingKey: binding.mappingKey,
							correspondenceRevision: 1,
							sourceRecordId: first.record.id,
							snapshotId: second.snapshot.id,
							ownerId: native.id,
							revision: result.revision,
							sourcePath: "/description",
						});
						return {
							...result,
							changes: [
								{
									kind: "software-record",
									ownerId: native.id,
									beforeRevision: 1,
									afterRevision: result.revision,
								},
							],
						};
					},
				);
				assert.equal(applied.status, "applied");
				await tx.execute(sql`set constraints all immediate`);
				await tx.execute(sql`set constraints all deferred`);
				const journalKey = {
					sourceRecordId: decision.sourceRecordId,
					proposalId: decision.proposalId,
					action: decision.action,
				};
				const journal = await readCatalogSourceApplication(tx, actor.id, journalKey);
				assert.equal(journal?.changes.length, 1);
				assert.equal(journal?.application.previousSnapshotId, first.snapshot.id);
				assert.deepEqual(journal?.changes[0], {
					kind: "software-record",
					ownerId: native.id,
					beforeRevision: 1,
					afterRevision: 3,
				});
				await assert.rejects(
					tx.transaction((nested) =>
						nested
							.update(catalogSourceApplication)
							.set({ changeCount: 0 })
							.where(
								and(
									eq(catalogSourceApplication.sourceRecordId, first.record.id),
									eq(catalogSourceApplication.proposalId, proposal.proposal.id),
								),
							),
					),
				);
				await assert.rejects(
					tx.transaction((nested) =>
						nested.insert(softwareSourceRecordApplicationChange).values({
							sourceRecordId: first.record.id,
							proposalId: proposal.proposal.id,
							action: "apply",
							position: 1,
							ownerId: native.id,
							beforeRevision: 1,
							afterRevision: 999,
						}),
					),
				);
				await assert.rejects(
					tx.transaction(async (nested) => {
						await nested.insert(softwareSourceRecordApplicationChange).values({
							sourceRecordId: first.record.id,
							proposalId: proposal.proposal.id,
							action: "apply",
							position: 1,
							ownerId: native.id,
							beforeRevision: 1,
							afterRevision: 3,
						});
						await nested.execute(sql`set constraints all immediate`);
					}),
					(error: unknown) =>
						error instanceof Error &&
						error.cause instanceof Error &&
						/in-progress application/u.test(error.cause.message),
				);
				const withdrawn = await decideCatalogSourceProposal(
					tx,
					actor.id,
					{ ...decision, action: "withdraw" },
					async (nested, context) => {
						assert.equal(context.action, "withdraw");
						const result = await restoreSoftwareDetails(
							nested,
							context.reference,
							context.actor,
							context.expectedRevision,
							1,
						);
						return {
							...result,
							changes: [
								{
									kind: "software-record",
									ownerId: native.id,
									beforeRevision: 3,
									afterRevision: result.revision,
								},
							],
						};
					},
				);
				assert.equal(withdrawn.status, "withdrawn");
				const compensation = await readCatalogSourceApplication(tx, actor.id, {
					...journalKey,
					action: "withdraw",
				});
				assert.equal(compensation?.changes[0]?.kind, "software-record");
				const [restoredBinding] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(
						and(
							eq(catalogSourceMappingClaim.sourceRecordId, first.record.id),
							eq(catalogSourceMappingClaim.mappingKey, binding.mappingKey),
						),
					)
					.limit(1);
				assert.equal(restoredBinding?.observedSnapshotId, first.snapshot.id);
				const reproposed = await proposeCatalogSourceAdoption(tx, actor.id, {
					sourceRecordId: first.record.id,
					mappingKey: binding.mappingKey,
					snapshotId: second.snapshot.id,
					mappingVersion: "native.fixture.1",
				});
				assert.equal(reproposed.status, "proposed");
				await assert.rejects(
					tx.transaction((nested) =>
						nested
							.update(catalogSourceAdoptionProposal)
							.set({ state: "pending" })
							.where(
								and(
									eq(catalogSourceAdoptionProposal.sourceRecordId, first.record.id),
									eq(catalogSourceAdoptionProposal.id, proposal.proposal.id),
								),
							),
					),
				);
				await tx.execute(sql`set constraints all immediate`);
				throw rollback;
			});
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		"Native source applications passed: exact component history FKs, immutable journal, complete manifest, source context and compensation; all rows rolled back.",
	);
} finally {
	await pool.end();
}
