import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { catalogSourceMappingClaim } from "../src/services/database/schema/catalog-source";
import { softwareRecordSourceOccurrence } from "../src/services/database/schema/catalog-software-source";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { VndbCatalogContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";
import {
	catalogSourceRecordId,
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { adoptVndbStaff } from "../src/services/catalog/vndb-entities";
import { adoptVndbVn } from "../src/services/catalog/vndb-adoption";
import { createVndbVnNativeWriter } from "../src/services/catalog/vndb-vn-update";
import { reviseCatalogSourceBinding } from "../src/services/catalog/source-bindings";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	addCatalogName,
	loadCatalogIdentity,
	listCatalogNames,
} from "../src/services/catalog/storage";
import { readSoftwareDetails, reviseSoftwareContent } from "../src/services/catalog/software";
import { readSoftwareParticipations } from "../src/services/catalog/software-participation";
import { readSoftwareParticipationContext } from "../src/services/catalog/software-contexts";
import { listCatalogFacts } from "../src/services/catalog/semantic-history";
import { listCatalogNameAuthority } from "../src/services/catalog/authority";
import { SoftwareSourceValueSchema } from "../src/services/catalog/software-source-values";
import { runWithNativeFixtureActor } from "./native-fixture-actor";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires isolated loopback Atlas target");
const archiveBytes = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		archiveBytes.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = archiveBytes.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const staff = {
	id: "s986001",
	aid: 986001,
	ismain: true,
	name: "Programmer",
	original: null,
	lang: "en",
	aliases: [{ aid: 986001, name: "Programmer", latin: null, ismain: true }],
};
const record = {
	id: "v986001",
	title: "Source title",
	olang: "ja",
	description: "Source description",
	devstatus: 0,
	titles: [{ lang: "ja", title: "作品", latin: "Sakuhin", official: true, main: true }],
	aliases: [],
	editions: [{ eid: 1, lang: "en", name: "Source staff group", official: true }],
	staff: [
		{
			id: staff.id,
			aid: staff.aid,
			name: staff.name,
			original: null,
			eid: 1,
			role: "programmer",
			note: null,
		},
	],
	length_minutes: 80,
	length_votes: 2,
	length: 2,
};
const bytes = Buffer.from(JSON.stringify(record)),
	staffBytes = Buffer.from(JSON.stringify(staff));
const receipt = await storeCatalogSourcePayload(
	vndbSourceKey(record.id),
	bytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const staffReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(staff.id),
	staffBytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const sourceRecordId = catalogSourceRecordId(vndbSourceKey(record.id));
const pool = new Pool({ connectionString, max: 1, statement_timeout: 30000 }),
	database = drizzle({ client: pool });
const rollback = new Error("rollback VNDB protocol refresh");
type RefreshDecision = {
	sourceRecordId: string;
	proposalId: string;
	mappingVersion: string;
	reason: string;
};
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Protocol refresh fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning();
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				for (const routingBucket of new Set(
					[record.id, staff.id].map((id) =>
						aggregateRoutingBucket("source_record", catalogSourceRecordId(vndbSourceKey(id))),
					),
				))
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket,
								lane,
								maximumRows: 10000n,
								maximumBytes: 256_000_000n,
							})),
						)
						.onConflictDoNothing();
				await adoptVndbStaff(tx, actor.id, staffReceipt, staffBytes);
				const adopted = await adoptVndbVn(tx, actor.id, receipt, bytes);
				if (adopted.status !== "created") throw new Error("Expected initial VN");
				const reference = adopted.reference;
				const local = await addCatalogName(tx, reference, actor.id, adopted.revision, {
					value: "Human title",
					languageTag: "en",
					kind: "variant",
				});
				await reviseSoftwareContent(tx, reference, actor.id, local.revision, {
					originalLanguageTag: "ja",
					developmentStatus: "finished",
					description: "Human description",
				});
				const [binding] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId));
				assert.ok(binding);
				const prepared = { snapshotId: adopted.snapshotId, receipt, bytes };
				const graph = async () => ({
					names: (await listCatalogNames(tx, reference, actor.id)).filter(
						(row) => row.state === "active" && row.id !== local.id,
					),
					credits: await readSoftwareParticipations(tx, reference, actor.id),
					facts: (await listCatalogFacts(tx, reference, actor.id, { maxSpoiler: 2 })).filter(
						(row) => row.state === "active",
					),
				});
				const original = await graph();
				assert.equal(original.credits.length, 1);
				assertions++;
				let previous = original,
					bindingRevision = binding.bindingRevision;
				const preserveHuman = async () => {
					const details = await readSoftwareDetails(tx, reference, actor.id);
					if (details.kind !== "content") throw new Error("Expected content");
					assert.equal(details.value?.description, "Human description");
					assertions++;
					assert.ok(
						(await listCatalogNames(tx, reference, actor.id)).some(
							(row) => row.id === local.id && row.state === "active" && row.value === "Human title",
						),
					);
					assertions++;
				};
				for (const mappingVersion of ["vndb.vn.3", "vndb.vn.4"] as const) {
					const revised = await reviseCatalogSourceBinding(tx, actor.id, {
						sourceRecordId,
						mappingKey: binding.mappingKey,
						expectedRevision: bindingRevision,
						state: "active",
						mode: "review",
						reason: "Reviewed mapper protocol replacement",
						mappingVersion,
					});
					bindingRevision = revised.revision;
					const writer = createVndbVnNativeWriter({
						before: null,
						after: prepared,
						mappingVersion,
					});
					const apply = async (): Promise<RefreshDecision> => {
						const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
							sourceRecordId,
							mappingKey: binding.mappingKey,
							snapshotId: adopted.snapshotId,
							mappingVersion,
						});
						if (proposal.status !== "proposed")
							throw new Error("Expected protocol refresh proposal");
						const decision: RefreshDecision = {
							sourceRecordId,
							proposalId: proposal.proposal.id,
							mappingVersion,
							reason: "Reviewed full native reinterpretation",
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
						return decision;
					};
					const decision = await apply();
					const current = await graph();
					assert.equal(current.names.length, previous.names.length);
					assertions++;
					assert.ok(current.names.every((row) => !previous.names.some((old) => old.id === row.id)));
					assertions++;
					assert.equal(current.credits.length, 1);
					assertions++;
					assert.notEqual(
						current.credits[0]?.participationId,
						previous.credits[0]?.participationId,
					);
					assertions++;
					assert.equal(current.facts.length, previous.facts.length);
					assertions++;
					assert.ok(
						current.facts.every(
							(row) => !previous.facts.some((old) => old.semanticId === row.semanticId),
						),
					);
					assertions++;
					const oldContext = previous.credits[0]?.contextId;
					assert.ok(oldContext);
					assert.equal(
						(await readSoftwareParticipationContext(tx, reference, actor.id, oldContext)).state,
						"withdrawn",
					);
					assertions++;
					await preserveHuman();
					const [source] = await tx
						.select()
						.from(softwareRecordSourceOccurrence)
						.where(
							and(
								eq(softwareRecordSourceOccurrence.sourceRecordId, sourceRecordId),
								eq(softwareRecordSourceOccurrence.correspondenceRevision, revised.revision),
								eq(softwareRecordSourceOccurrence.snapshotId, adopted.snapshotId),
							),
						);
					assert.ok(source);
					const interpreted = SoftwareSourceValueSchema.parse({
						sourceShape: source.sourceShape,
						sourceValue: source.sourceValue,
					});
					if (interpreted.sourceShape !== "content")
						throw new Error("Expected interpreted content");
					assert.equal(interpreted.sourceValue.description, "Source description");
					assertions++;
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
					const restored = await graph();
					assert.deepEqual(
						restored.names.map((row) => row.id).sort(),
						previous.names.map((row) => row.id).sort(),
					);
					assertions++;
					assert.equal(restored.credits[0]?.participationId, previous.credits[0]?.participationId);
					assertions++;
					assert.deepEqual(
						restored.facts.map((row) => row.semanticId).sort(),
						previous.facts.map((row) => row.semanticId).sort(),
					);
					assertions++;
					const title = restored.names.find((row) => row.value === "作品");
					assert.ok(title);
					assert.ok(
						(
							await listCatalogNameAuthority(tx, reference, actor.id, title.id, title.revision)
						).some(
							(claim) =>
								claim.state === "active" &&
								claim.claim === "official" &&
								claim.reviewState === "source_claim",
						),
					);
					assertions++;
					await preserveHuman();
					await apply();
					previous = await graph();
					await preserveHuman();
				}
				const conflictBytes = Buffer.from(
					JSON.stringify({ ...record, description: "A changed source description" }),
				);
				const conflictReceipt = await storeCatalogSourcePayload(
						vndbSourceKey(record.id),
						conflictBytes,
						VndbCatalogContractSha256,
						null,
						archive,
					),
					conflictSnapshot = await recordCatalogSourceObservation(tx, conflictReceipt);
				const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
					sourceRecordId,
					mappingKey: binding.mappingKey,
					snapshotId: conflictSnapshot.snapshot.id,
					mappingVersion: "vndb.vn.4",
				});
				if (proposal.status !== "proposed") throw new Error("Expected conflicting source proposal");
				const before = await loadCatalogIdentity(tx, reference, actor.id, true);
				await assert.rejects(
					() =>
						tx.transaction((nested) =>
							decideCatalogSourceProposal(
								nested,
								actor.id,
								{
									sourceRecordId,
									proposalId: proposal.proposal.id,
									mappingVersion: "vndb.vn.4",
									action: "apply",
									reason: "Must preserve human scalar edit",
								},
								createVndbVnNativeWriter({
									before: prepared,
									after: {
										snapshotId: conflictSnapshot.snapshot.id,
										receipt: conflictReceipt,
										bytes: conflictBytes,
									},
									mappingVersion: "vndb.vn.4",
								}),
							),
						),
					/conflicts with native description/,
				);
				assertions++;
				assert.equal(
					(await loadCatalogIdentity(tx, reference, actor.id, true)).revision,
					before.revision,
				);
				assertions++;
				await preserveHuman();
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			check: "vndb-protocol-refresh",
			protocols: [2, 3, 4],
			assertions,
			rolledBack: true,
		}),
	);
} finally {
	await pool.end();
}
