import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { catalogSourceMappingClaim } from "../src/services/database/schema/catalog-source";
import { CatalogStructureSourceTables } from "../src/services/database/schema/catalog-structure-source";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import {
	createCatalogIdentity,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	recordCatalogChange,
} from "../src/services/catalog/storage";
import { createProgramStructure, updateProgramStructure } from "../src/services/catalog/program";
import { updatePublishingStructure } from "../src/services/catalog/publishing";
import {
	readStructureComponentHead,
	programStructureRevisionValue,
	publishingStructureRevisionValue,
} from "../src/services/catalog/structure-history";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "../src/services/catalog/source-child-correspondence";
import {
	bindStructureSourceOccurrence,
	writeCatalogStructureSource,
	compensateCatalogStructureSource,
} from "../src/services/catalog/structure-source";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
	type CatalogSourceNativeWriter,
} from "../src/services/catalog/source-proposals";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";
import type { CatalogReference } from "../src/services/catalog/contracts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires disposable loopback Atlas target");
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
const pool = new Pool({ connectionString, max: 1, statement_timeout: 30000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback structural source fixture");
let assertions = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Native structure source fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				for (const owner of ["program", "publishing"] as const) {
					const key = {
							source: "fixture.structure",
							objectType: owner,
							externalId: "native-fields",
						},
						sourceRecordId = catalogSourceRecordId(key);
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								lane,
								routingBucket: aggregateRoutingBucket("source_record", sourceRecordId),
								maximumRows: 5000n,
								maximumBytes: 128000000n,
							})),
						)
						.onConflictDoNothing();
					const types = await Promise.all(
						["a", "b"].map((value) =>
							ensureCatalogDefinition(tx, {
								namespace: "fixture.structure_type",
								key: value,
								kind: "vocabulary",
								valueKind: null,
								constraints: {
									targets: [{ owner: "program", shapes: ["program"] }],
									slots: ["type"],
								},
							}),
						),
					);
					const firstType = types[0]?.revisionId,
						secondType = types[1]?.revisionId;
					assert.ok(firstType && secondType);
					const beforeValue =
						owner === "program"
							? {
									shape: "program" as const,
									fields: { typeRevisionId: firstType, declaredMainEpisodeCount: 7 },
								}
							: {
									shape: "publication" as const,
									fields: { pageCount: 100, paginationText: "Human pagination" },
								};
					const afterValue =
						owner === "program"
							? { shape: "program" as const, fields: { typeRevisionId: secondType } }
							: { shape: "publication" as const, fields: { pageCount: 120 } };
					const observedFields = owner === "program" ? ["typeRevisionId"] : ["pageCount"],
						component = owner === "program" ? "program_work" : "publishing_publication";
					let reference: CatalogReference, revision: number;
					if (owner === "program") {
						const created = await createProgramStructure(
							tx,
							actor.id,
							{
								shape: "program",
								fields: { typeRevisionId: firstType, declaredMainEpisodeCount: 7 },
							},
							{ value: "Native program", languageTag: "en" },
						);
						reference = { owner, id: created.id };
						revision = created.revision;
					} else {
						const created = await createCatalogIdentity(
							tx,
							{ owner, shape: "publication" },
							actor.id,
						);
						reference = { owner, id: created.id };
						revision = (
							await updatePublishingStructure(tx, reference, actor.id, created.revision, {
								shape: "publication",
								fields: { pageCount: 100, paginationText: "Human pagination" },
							})
						).revision;
					}
					const beforeBytes = Buffer.from(JSON.stringify({ value: "before" })),
						afterBytes = Buffer.from(JSON.stringify({ value: "after" }));
					const beforeReceipt = await storeCatalogSourcePayload(
							key,
							beforeBytes,
							"a".repeat(64),
							null,
							archive,
						),
						afterReceipt = await storeCatalogSourcePayload(
							key,
							afterBytes,
							"a".repeat(64),
							null,
							archive,
						);
					const before = await recordCatalogSourceDocument(tx, beforeReceipt, beforeBytes);
					await prepareCatalogSourceChildCorrespondence(tx, actor.id, {
						sourceRecordId,
						snapshotId: before.snapshot.id,
						reference,
						mappingVersion: "fixture.structure.1",
					});
					const initialHead = await readStructureComponentHead(
						tx,
						reference,
						component,
						reference.id,
					);
					assert.ok(initialHead);
					await bindStructureSourceOccurrence(tx, reference, actor.id, {
						sourceRecordId,
						snapshotId: before.snapshot.id,
						sourcePath: "/",
						historyId: initialHead.id,
						sourceValue: beforeValue,
						observedFields,
					});
					await sealCatalogSourceChildCorrespondence(tx, actor.id, {
						sourceRecordId,
						snapshotId: before.snapshot.id,
						path: "/",
						reference,
						mappingVersion: "fixture.structure.1",
					});
					const after = await recordCatalogSourceDocument(tx, afterReceipt, afterBytes);
					const [binding] = await tx
						.select()
						.from(catalogSourceMappingClaim)
						.where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId))
						.limit(1);
					assert.ok(binding);
					const writer: CatalogSourceNativeWriter = async (write, context) => {
						let changed;
						if (context.action === "apply")
							changed = await writeCatalogStructureSource(
								write,
								context.reference,
								context.actor,
								context.expectedRevision,
								{
									sourceRecordId,
									snapshotId: after.snapshot.id,
									previousSnapshotId: before.snapshot.id,
									sourcePath: "/",
									sourceValue: afterValue,
									observedFields,
								},
							);
						else {
							const applied = await readCatalogSourceApplication(write, context.actor, {
								sourceRecordId,
								proposalId: context.proposalId,
								action: "apply",
							});
							assert.ok(applied);
							const structural = applied.changes.find(
								(change) => change.kind === "catalog-structure",
							);
							if (!structural || structural.kind !== "catalog-structure")
								throw new Error("Missing structural source change");
							const inverse = await compensateCatalogStructureSource(
								write,
								context.actor,
								structural,
							);
							changed = {
								revision: (await loadCatalogIdentity(write, context.reference, context.actor, true))
									.revision,
								changes: [inverse],
							};
						}
						return {
							revision: await recordCatalogChange(
								write,
								context.reference,
								context.actor,
								changed.revision,
								`fixture.structure.${context.action}`,
							),
							changes: changed.changes,
						};
					};
					const verify = async (updated: boolean) => {
						const head = await readStructureComponentHead(tx, reference, component, reference.id);
						assert.ok(head);
						if (owner === "program") {
							const value = programStructureRevisionValue(component, head.value);
							if (value.shape !== "program") throw new Error("Expected program");
							assert.equal(value.fields.typeRevisionId, updated ? secondType : firstType);
							assert.equal(value.fields.declaredMainEpisodeCount, 7);
						} else {
							const value = publishingStructureRevisionValue(component, head.value);
							if (value.shape !== "publication") throw new Error("Expected publication");
							assert.equal(value.fields.pageCount, updated ? 120 : 100);
							assert.equal(value.fields.paginationText, "Human pagination");
						}
						assertions += 2;
						const tables = CatalogStructureSourceTables[owner];
						const [baseline] = await tx
							.select()
							.from(tables.baseline)
							.where(
								and(
									eq(tables.baseline.sourceRecordId, sourceRecordId),
									eq(tables.baseline.ownerId, reference.id),
								),
							)
							.limit(1);
						assert.ok(baseline);
						assert.equal(baseline.currentHistoryId, head.id);
						assertions++;
						const [pure] = await tx
							.select()
							.from(tables.occurrence)
							.where(
								and(
									eq(tables.occurrence.sourceRecordId, sourceRecordId),
									eq(
										tables.occurrence.snapshotId,
										updated ? after.snapshot.id : before.snapshot.id,
									),
								),
							)
							.limit(1);
						assert.ok(pure);
						assert.deepEqual(pure.observedFields, observedFields);
						assert.equal(
							Reflect.get(
								pure.sourceValue.fields,
								owner === "program" ? "declaredMainEpisodeCount" : "paginationText",
							),
							null,
						);
						assertions += 2;
					};
					for (let cycle = 0; cycle < 3; cycle++) {
						const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
							sourceRecordId,
							mappingKey: binding.mappingKey,
							snapshotId: after.snapshot.id,
							mappingVersion: "fixture.structure.1",
						});
						if (proposal.status !== "proposed")
							throw new Error("Expected structure source proposal");
						const decision = {
							sourceRecordId,
							proposalId: proposal.proposal.id,
							mappingVersion: "fixture.structure.1",
							reason: "Native structural source fixture",
						};
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									actor.id,
									{ ...decision, action: "apply" },
									writer,
								)
							).status,
							"applied",
						);
						assertions++;
						await verify(true);
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									actor.id,
									{ ...decision, action: "withdraw" },
									writer,
								)
							).status,
							"withdrawn",
						);
						assertions++;
						await verify(false);
					}
					const occurrence = CatalogStructureSourceTables[owner].occurrence;
					await assert.rejects(
						() =>
							tx.transaction((write) =>
								write.execute(
									sql`update ${occurrence} set source_path='/changed' where ${occurrence.sourceRecordId}=${sourceRecordId}`,
								),
							),
						/immutable|retained/i,
					);
					assertions++;
					const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
						sourceRecordId,
						mappingKey: binding.mappingKey,
						snapshotId: after.snapshot.id,
						mappingVersion: "fixture.structure.1",
					});
					if (proposal.status !== "proposed") throw new Error("Expected final structure proposal");
					const decision = {
						sourceRecordId,
						proposalId: proposal.proposal.id,
						mappingVersion: "fixture.structure.1",
						reason: "Check exact current child compensation fence",
					};
					await decideCatalogSourceProposal(tx, actor.id, { ...decision, action: "apply" }, writer);
					revision = (await loadCatalogIdentity(tx, reference, actor.id, true)).revision;
					if (owner === "program")
						await updateProgramStructure(tx, reference, actor.id, revision, {
							shape: "program",
							fields: { typeRevisionId: secondType, declaredMainEpisodeCount: 8 },
						});
					else
						await updatePublishingStructure(tx, reference, actor.id, revision, {
							shape: "publication",
							fields: { pageCount: 120, paginationText: "Later human correction" },
						});
					await assert.rejects(
						() =>
							tx.transaction((write) =>
								decideCatalogSourceProposal(
									write,
									actor.id,
									{ ...decision, action: "withdraw" },
									writer,
								),
							),
						/structure component changed/i,
					);
					assertions++;
				}
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			check: "catalog-structure-source",
			owners: 2,
			cycles: 3,
			assertions,
			rolledBack: true,
		}),
	);
} finally {
	await pool.end();
}
