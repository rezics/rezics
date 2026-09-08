import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	catalogSourceRecordId,
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { MusicBrainzCatalogContractSha256 } from "../src/services/catalog/musicbrainz";
import { adoptMusicBrainzSupportingEndpoint } from "../src/services/catalog/musicbrainz-entities-adoption";
import { createMusicBrainzNativeWriter } from "../src/services/catalog/musicbrainz-writer";
import { prepareMusicBrainzProposalDependencies } from "../src/services/catalog/musicbrainz-dependencies";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { lockCatalogSourceBinding } from "../src/services/catalog/source-bindings";
import { resolveCatalogSourceChildCorrespondence } from "../src/services/catalog/source-child-correspondence";
import {
	readCatalogProfileHead,
	readCatalogSourceProfile,
} from "../src/services/catalog/profile-source";
import { initializeEntityProfile } from "../src/services/catalog/entities";
import { EntityProfileSchema } from "../src/services/catalog/entity-contracts";
import {
	listCatalogNames,
	loadCatalogIdentity,
	pageCatalogRelations,
	readCatalogParticipants,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable music supporting fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(target.hostname) ||
	target.port !== "25434" ||
	target.pathname !== "/rezics_atlas"
)
	throw new Error("Music supporting fixture requires isolated loopback target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		objects.set(value.Key, value.Body);
	},
	async get({ Key }) {
		const value = objects.get(Key);
		return { Body: value ? Readable.from([value]) : undefined };
	},
};
const rollback = new Error("rollback music supporting fixture");
let checks = 0;
const cases: { kind: string; before: Record<string, unknown>; after: Record<string, unknown> }[] = [
	{
		kind: "artist",
		before: {
			type: "Person",
			gender: "Male",
			"life-span": { begin: "1980" },
			ipis: ["00012345678"],
		},
		after: {
			type: "Person",
			gender: "Male",
			"life-span": { begin: "1981" },
			ipis: ["00012345679"],
		},
	},
	{ kind: "label", before: { "label-code": 101 }, after: { "label-code": 102 } },
	{
		kind: "area",
		before: { "life-span": { begin: "1900" } },
		after: { "life-span": { begin: "1901" } },
	},
	{
		kind: "place",
		before: { address: "First street", coordinates: { latitude: 35, longitude: 139 } },
		after: { address: "Second street", coordinates: { latitude: 35.1, longitude: 139.1 } },
	},
	{
		kind: "event",
		before: { time: "18:00", cancelled: false, setlist: "First song" },
		after: { time: "19:00", cancelled: true, setlist: "Second song" },
	},
	{
		kind: "instrument",
		before: { description: "First instrument description" },
		after: { description: "Changed instrument description" },
	},
	{
		kind: "genre",
		before: { description: "First genre description" },
		after: { description: "Changed genre description" },
	},
	{
		kind: "mood",
		before: { description: "First mood description" },
		after: { description: "Changed mood description" },
	},
	{
		kind: "series",
		before: { "ordering-type": "Automatic" },
		after: { "ordering-type": "Manual" },
	},
	{
		kind: "url",
		before: { resource: "https://example.invalid/first" },
		after: { resource: "https://example.invalid/second" },
	},
];
try {
	try {
		await db.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Music supporting fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning({ id: users.id });
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				for (const item of cases) {
					const relation = {
						"type-id": crypto.randomUUID(),
						type: "Related to",
						direction: "forward",
						"target-type": "artist",
						artist: { id: crypto.randomUUID(), name: "Referenced artist" },
						begin: "2000",
						ended: false,
						"source-credit": "Before relation credit",
					};
					const key = {
							source: "musicbrainz",
							objectType: item.kind,
							externalId: crypto.randomUUID(),
						},
						sourceRecordId = catalogSourceRecordId(key);
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket: aggregateRoutingBucket("source_record", sourceRecordId),
								lane,
								maximumRows: 10000n,
								maximumBytes: 64000000n,
							})),
						)
						.onConflictDoNothing();
					const beforeBytes = Buffer.from(
						JSON.stringify({
							id: key.externalId,
							relations: [relation],
							...(item.kind === "url" ? {} : { name: "Before", annotation: "Original annotation" }),
							...item.before,
						}),
					);
					const beforeReceipt = await storeCatalogSourcePayload(
						key,
						beforeBytes,
						MusicBrainzCatalogContractSha256,
						null,
						archive,
					);
					const adopted = await adoptMusicBrainzSupportingEndpoint(
						tx,
						account.id,
						beforeReceipt,
						beforeBytes,
					);
					assert.equal(adopted.status, "created");
					assert.ok("reference" in adopted);
					checks++;
					const reference = adopted.reference;
					const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
					const binding = await lockCatalogSourceBinding(tx, {
						sourceRecordId,
						mappingKey: scope.mappingKey,
					});
					assert.ok(binding.claim.observedSnapshotId);
					if (item.kind === "artist") {
						const current = await readCatalogProfileHead(tx, reference, account.id);
						assert.ok(current);
						const identity = await loadCatalogIdentity(tx, reference, account.id, true);
						await initializeEntityProfile(tx, reference, account.id, identity.revision, {
							...EntityProfileSchema.parse(current.snapshot),
							ended: true,
						});
					}
					const afterBytes = Buffer.from(
						JSON.stringify({
							id: key.externalId,
							relations: [{ ...relation, begin: "2001", "source-credit": "After relation credit" }],
							...(item.kind === "url" ? {} : { name: "After", annotation: "Changed annotation" }),
							...item.after,
						}),
					);
					const afterReceipt = await storeCatalogSourcePayload(
						key,
						afterBytes,
						MusicBrainzCatalogContractSha256,
						null,
						archive,
					);
					const observation = await recordCatalogSourceDocument(tx, afterReceipt, afterBytes);
					const writer = createMusicBrainzNativeWriter({
						before: {
							snapshotId: binding.claim.observedSnapshotId,
							receipt: beforeReceipt,
							bytes: beforeBytes,
						},
						after: {
							snapshotId: observation.snapshot.id,
							receipt: afterReceipt,
							bytes: afterBytes,
						},
					});
					for (let cycle = 0; cycle < 2; cycle++) {
						const proposed = await proposeCatalogSourceAdoption(tx, account.id, {
							sourceRecordId,
							mappingKey: scope.mappingKey,
							snapshotId: observation.snapshot.id,
							mappingVersion: `musicbrainz.${item.kind}.1`,
						});
						assert.ok("proposal" in proposed);
						assert.ok(proposed.proposal);
						await prepareMusicBrainzProposalDependencies(tx, account.id, {
							sourceRecordId,
							snapshotId: observation.snapshot.id,
							proposalId: proposed.proposal.id,
							receipt: afterReceipt,
							bytes: afterBytes,
						});
						const decision = {
							sourceRecordId,
							proposalId: proposed.proposal.id,
							mappingVersion: `musicbrainz.${item.kind}.1`,
							reason: "Check exact native supporting update",
						};
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									account.id,
									{ ...decision, action: "apply" },
									writer,
								)
							).status,
							"applied",
						);
						checks++;
						const activeRelations = await pageCatalogRelations(tx, reference, account.id);
						assert.equal(activeRelations.items.length, 1);
						assert.ok(activeRelations.items[0]);
						assert.ok(
							(
								await readCatalogParticipants(
									tx,
									reference,
									activeRelations.items[0].id,
									account.id,
								)
							).some((participant) => participant.creditedAs === "After relation credit"),
						);
						checks += 2;
						assert.ok(
							(await listCatalogNames(tx, reference, account.id)).some(
								(name) =>
									name.value === (item.kind === "url" ? item.after.resource : "After") &&
									name.state === "active",
							),
						);
						checks++;
						if (item.kind === "artist") {
							const native = await readCatalogProfileHead(tx, reference, account.id);
							assert.ok(native);
							assert.equal(EntityProfileSchema.parse(native.snapshot).ended, true);
							checks++;
							const pure = await readCatalogSourceProfile(tx, reference, account.id, {
								sourceRecordId,
								snapshotId: observation.snapshot.id,
								...scope,
							});
							assert.ok(pure);
							assert.equal(EntityProfileSchema.parse(pure.sourceProfile).ended, null);
							assert.ok(!pure.observedFields.includes("ended"));
							checks += 2;
						}
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									account.id,
									{ ...decision, action: "withdraw" },
									writer,
								)
							).status,
							"withdrawn",
						);
						const restoredRelations = await pageCatalogRelations(tx, reference, account.id);
						assert.equal(restoredRelations.items.length, 1);
						assert.ok(restoredRelations.items[0]);
						assert.ok(
							(
								await readCatalogParticipants(
									tx,
									reference,
									restoredRelations.items[0].id,
									account.id,
								)
							).some((participant) => participant.creditedAs === "Before relation credit"),
						);
						checks += 2;
						checks++;
						assert.ok(
							(await listCatalogNames(tx, reference, account.id)).some(
								(name) =>
									name.value === (item.kind === "url" ? item.before.resource : "Before") &&
									name.state === "active",
							),
						);
						checks++;
					}
				}
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified ${checks} native MusicBrainz supporting update, compensation and pure-profile assertions across 10 endpoint kinds; fixture rolled back`,
	);
} finally {
	await pool.end();
}
