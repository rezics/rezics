import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { CatalogProfileSourceTables } from "../src/services/database/schema/catalog-profile-source";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { createEntity, initializeEntityProfile } from "../src/services/catalog/entities";
import { createReference, initializeReferenceProfile } from "../src/services/catalog/references";
import {
	EntityProfileSchema,
	ReferenceProfileSchema,
} from "../src/services/catalog/entity-contracts";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
} from "../src/services/catalog/storage";
import {
	bindCatalogProfileSourceOccurrence,
	compensateCatalogProfileSourceChange,
	readCatalogProfileHead,
	resolveCatalogProfileSourceBaseline,
	writeCatalogSourceProfile,
} from "../src/services/catalog/profile-source";
import { bindCatalogSourceIdentity } from "../src/services/catalog/source-bindings";
import {
	decideCatalogSourceProposal,
	proposeCatalogSourceAdoption,
	type CatalogSourceNativeWriter,
} from "../src/services/catalog/source-proposals";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";
import {
	catalogSourceRecordId,
	recordCatalogSourceDocument,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import type { CatalogReference } from "../src/services/catalog/contracts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable profile fixture configuration required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)
)
	throw new Error("Profile fixture requires isolated loopback rezics_atlas");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
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
const rollback = new Error("rollback profile source fixture");
let checks = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({ name: "Profile source fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning();
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				for (const owner of ["entity", "reference"] as const) {
					const key = {
						source: "profile_fixture",
						objectType: owner,
						externalId: crypto.randomUUID(),
					};
					const routingBucket = aggregateRoutingBucket("source_record", catalogSourceRecordId(key));
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket,
								lane,
								maximumRows: 10000n,
								maximumBytes: 64000000n,
							})),
						)
						.onConflictDoNothing();
					const beforeProfile =
						owner === "entity"
							? EntityProfileSchema.parse({ begin: { year: 1960, month: null, day: null } })
							: ReferenceProfileSchema.parse({ shape: "place", address: "First venue address" });
					const afterProfile =
						owner === "entity"
							? EntityProfileSchema.parse({ begin: { year: 1970, month: null, day: null } })
							: ReferenceProfileSchema.parse({ shape: "place", address: "Second venue address" });
					const beforeBytes = Buffer.from(JSON.stringify({ profile: beforeProfile }));
					const afterBytes = Buffer.from(JSON.stringify({ profile: afterProfile }));
					const before = await recordCatalogSourceDocument(
						tx,
						await storeCatalogSourcePayload(key, beforeBytes, "a".repeat(64), null, archive),
						beforeBytes,
					);
					const reference: CatalogReference & { revision: number } =
						owner === "entity"
							? await createEntity(tx, account.id, {
									shape: "person",
									name: { value: "Artist", languageTag: "en" },
									profile: EntityProfileSchema.parse(beforeProfile),
								})
							: await createReference(tx, account.id, {
									name: { value: "Venue", languageTag: "en" },
									profile: ReferenceProfileSchema.parse(beforeProfile),
								});
					const original = await readCatalogProfileHead(tx, reference, account.id);
					assert.ok(original);
					await bindCatalogProfileSourceOccurrence(tx, reference, account.id, {
						sourceRecordId: before.record.id,
						snapshotId: before.snapshot.id,
						sourcePath: "/profile",
						revision: original.revision,
					});
					const binding = await bindCatalogSourceIdentity(tx, account.id, {
						sourceRecordId: before.record.id,
						snapshotId: before.snapshot.id,
						path: "/",
						reference,
						mappingVersion: "profile.fixture.1",
					});
					const after = await recordCatalogSourceDocument(
						tx,
						await storeCatalogSourcePayload(key, afterBytes, "a".repeat(64), null, archive),
						afterBytes,
					);
					const writer: CatalogSourceNativeWriter = async (write, context) => {
						if (context.action === "apply") {
							const expected = await resolveCatalogProfileSourceBaseline(
								write,
								reference,
								{ sourceRecordId: before.record.id, mappingKey: binding.mappingKey },
								original.revision,
							);
							const saved = await writeCatalogSourceProfile(
								write,
								reference,
								context.actor,
								context.expectedRevision,
								{
									expectedProfileRevision: expected,
									profile: afterProfile,
									sourceRecordId: after.record.id,
									snapshotId: after.snapshot.id,
									sourcePath: "/profile",
								},
							);
							return { revision: saved.revision, changes: [saved.change] };
						}
						const applied = await readCatalogSourceApplication(write, context.actor, {
							sourceRecordId: context.sourceRecordId,
							proposalId: context.proposalId,
							action: "apply",
						});
						const change = applied?.changes[0];
						if (!change || change.kind !== "catalog-profile")
							throw new Error("Expected exact profile journal");
						const inverse = await compensateCatalogProfileSourceChange(
							write,
							context.actor,
							change,
						);
						return {
							revision: (await loadCatalogIdentity(write, reference, context.actor, true)).revision,
							changes: [inverse],
						};
					};
					for (let cycle = 0; cycle < 3; cycle++) {
						const proposal = await proposeCatalogSourceAdoption(tx, account.id, {
							sourceRecordId: after.record.id,
							mappingKey: binding.mappingKey,
							snapshotId: after.snapshot.id,
							mappingVersion: "profile.fixture.1",
						});
						assert.equal(proposal.status, "proposed");
						if (proposal.status !== "proposed") throw new Error("Expected proposal");
						const decision = {
							sourceRecordId: after.record.id,
							proposalId: proposal.proposal.id,
							mappingVersion: "profile.fixture.1",
							reason: "Reviewed profile fixture",
						};
						await decideCatalogSourceProposal(
							tx,
							account.id,
							{ ...decision, action: "apply" },
							writer,
						);
						assert.deepEqual(
							(await readCatalogProfileHead(tx, reference, account.id))?.snapshot,
							afterProfile,
						);
						const identity = await loadCatalogIdentity(tx, reference, account.id, true);
						const local = await addCatalogName(tx, reference, account.id, identity.revision, {
							kind: "alias",
							languageTag: "en",
							value: `Independent name ${cycle}`,
						});
						await decideCatalogSourceProposal(
							tx,
							account.id,
							{ ...decision, action: "withdraw" },
							writer,
						);
						assert.deepEqual(
							(await readCatalogProfileHead(tx, reference, account.id))?.snapshot,
							beforeProfile,
						);
						assert.equal(
							(await loadCatalogIdentity(tx, reference, account.id, true)).revision,
							local.revision + 1,
						);
						checks += 4;
					}
					const proposal = await proposeCatalogSourceAdoption(tx, account.id, {
						sourceRecordId: after.record.id,
						mappingKey: binding.mappingKey,
						snapshotId: after.snapshot.id,
						mappingVersion: "profile.fixture.1",
					});
					if (proposal.status !== "proposed") throw new Error("Expected final proposal");
					const decision = {
						sourceRecordId: after.record.id,
						proposalId: proposal.proposal.id,
						mappingVersion: "profile.fixture.1",
						reason: "Check independent native protection",
					};
					await decideCatalogSourceProposal(
						tx,
						account.id,
						{ ...decision, action: "apply" },
						writer,
					);
					const current = await loadCatalogIdentity(tx, reference, account.id, true);
					if (owner === "entity")
						await initializeEntityProfile(tx, reference, account.id, current.revision, {
							begin: { year: 1980, month: null, day: null },
						});
					else
						await initializeReferenceProfile(tx, reference, account.id, current.revision, {
							shape: "place",
							address: "Independent human address",
						});
					await assert.rejects(
						() =>
							tx.transaction((nested) =>
								decideCatalogSourceProposal(
									nested,
									account.id,
									{ ...decision, action: "withdraw" },
									writer,
								),
							),
						/independent values/,
					);
					const table = CatalogProfileSourceTables[owner];
					await assert.rejects(() =>
						tx.transaction((nested) =>
							nested
								.update(table)
								.set({ sourcePath: "/rewritten" })
								.where(
									and(eq(table.sourceRecordId, before.record.id), eq(table.ownerId, reference.id)),
								),
						),
					);
					checks += 2;
					const stub = await createCatalogIdentity(
						tx,
						{ owner, shape: owner === "entity" ? "person" : "place" },
						account.id,
					);
					const filled = await writeCatalogSourceProfile(tx, stub, account.id, stub.revision, {
						expectedProfileRevision: null,
						profile: afterProfile,
						sourceRecordId: after.record.id,
						snapshotId: after.snapshot.id,
						sourcePath: "/profile",
					});
					await compensateCatalogProfileSourceChange(tx, account.id, filled.change);
					assert.equal((await readCatalogProfileHead(tx, stub, account.id))?.removed, true);
					checks++;
				}
				await tx.execute(sql`set constraints all immediate`);
				throw rollback;
			});
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ checks, rolledBack: true, cycles: 3, owners: ["entity", "reference"] }),
	);
} finally {
	await pool.end();
}
