import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	catalogSourceRecordId,
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	loadCatalogSourceDocument,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { MusicBrainzCatalogContractSha256 } from "../src/services/catalog/musicbrainz";
import { adoptMusicBrainzRelease } from "../src/services/catalog/musicbrainz-adoption";
import { applyMusicBrainzNameDelta } from "../src/services/catalog/musicbrainz-name-delta";
import { compensateMusicSourceApplication } from "../src/services/catalog/music-source-compensation";
import { resolveCatalogSourceChildCorrespondence } from "../src/services/catalog/source-child-correspondence";
import { reviseCatalogSourceBinding } from "../src/services/catalog/source-bindings";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
	type CatalogSourceNativeWriter,
} from "../src/services/catalog/source-proposals";
import { listCatalogNames, recordCatalogChange } from "../src/services/catalog/storage";
import { requireCatalogNameRevision, reviseCatalogName } from "../src/services/catalog/names";
import { catalogNameRevisionValues } from "../src/services/catalog/source-owned-compensation";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable name epoch fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(target.hostname) ||
	target.port !== "25434" ||
	target.pathname !== "/rezics_atlas"
)
	throw new Error("Name epoch fixture requires isolated loopback target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	db = drizzle({ client: pool });
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		objects.set(value.Key, value.Body);
	},
	async get({ Key }) {
		const body = objects.get(Key);
		return { Body: body ? Readable.from([body]) : undefined };
	},
};
const rollback = new Error("rollback music name epoch fixture");
let checks = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Music name epoch fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning({ id: users.id });
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				const key = {
						source: "musicbrainz",
						objectType: "release",
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
				const before = {
					id: key.externalId,
					title: "Before",
					media: [],
					aliases: [{ name: "Stable", locale: "en" }],
				};
				const beforeBytes = Buffer.from(JSON.stringify(before));
				const beforeReceipt = await storeCatalogSourcePayload(
					key,
					beforeBytes,
					MusicBrainzCatalogContractSha256,
					null,
					archive,
				);
				const adopted = await adoptMusicBrainzRelease(tx, account.id, beforeReceipt, beforeBytes);
				assert.equal(adopted.status, "created");
				assert.ok("reference" in adopted);
				const reference = adopted.reference,
					scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
				const original = await recordCatalogSourceDocument(tx, beforeReceipt, beforeBytes);
				const alias = (await listCatalogNames(tx, reference, account.id)).find(
					(name) => name.value === "Stable",
				);
				assert.ok(alias);
				const pure = await requireCatalogNameRevision(
					tx,
					reference,
					account.id,
					alias.id,
					alias.revision,
				);
				await reviseCatalogName(tx, reference, account.id, alias.id, alias.revision, {
					...catalogNameRevisionValues(pure),
					value: "Curator correction",
				});
				const after = {
					...before,
					title: "After",
					aliases: [
						{ name: "Added", locale: "de" },
						{ name: "Stable", locale: "en", "provider-note": "unmapped metadata changed" },
					],
				};
				const afterBytes = Buffer.from(JSON.stringify(after));
				const afterReceipt = await storeCatalogSourcePayload(
					key,
					afterBytes,
					MusicBrainzCatalogContractSha256,
					null,
					archive,
				);
				const incoming = await recordCatalogSourceDocument(tx, afterReceipt, afterBytes);
				const mappingVersion = "musicbrainz.name-plan-fixture.2";
				await reviseCatalogSourceBinding(tx, account.id, {
					sourceRecordId,
					mappingKey: scope.mappingKey,
					expectedRevision: 1,
					state: "active",
					mode: "review",
					mappingVersion,
					reason: "Qualify a native name plan across an exact source epoch",
				});
				// This fixture tests the name owner, not a complete registered MusicBrainz mapper.
				const writer: CatalogSourceNativeWriter = async (write, context) => {
					if (context.action === "withdraw")
						return compensateMusicSourceApplication(write, context);
					assert.equal(context.previousSnapshotId, null);
					checks++;
					await loadCatalogSourceDocument(
						write,
						sourceRecordId,
						incoming.snapshot.id,
						afterReceipt,
						afterBytes,
					);
					const result = await applyMusicBrainzNameDelta(
						write,
						reference,
						context.actor,
						context.expectedRevision,
						{
							sourceRecordId,
							mappingKey: scope.mappingKey,
							previousSnapshotId: original.snapshot.id,
							snapshotId: incoming.snapshot.id,
							previousCorrespondenceRevision: scope.correspondenceRevision,
						},
						after,
					);
					if (result.revision === context.expectedRevision)
						result.revision = await recordCatalogChange(
							write,
							reference,
							context.actor,
							result.revision,
							"fixture.name.epoch",
						);
					return result;
				};
				for (let cycle = 0; cycle < 3; cycle++) {
					const proposed = await proposeCatalogSourceAdoption(tx, account.id, {
						sourceRecordId,
						mappingKey: scope.mappingKey,
						snapshotId: incoming.snapshot.id,
						mappingVersion,
					});
					assert.ok("proposal" in proposed);
					assert.ok(proposed.proposal);
					const decision = {
						sourceRecordId,
						proposalId: proposed.proposal.id,
						mappingVersion,
						reason: "Exact native-name epoch fixture",
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
					const names = await listCatalogNames(tx, reference, account.id);
					assert.ok(names.some((name) => name.value === "After" && name.state === "active"));
					assert.ok(
						names.some(
							(name) =>
								name.id === alias.id &&
								name.value === "Curator correction" &&
								name.state === "active",
						),
					);
					checks += 2;
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
					checks++;
					const restored = await listCatalogNames(tx, reference, account.id);
					assert.ok(restored.some((name) => name.value === "Before" && name.state === "active"));
					assert.ok(
						restored.some(
							(name) =>
								name.id === alias.id &&
								name.value === "Curator correction" &&
								name.state === "active",
						),
					);
					checks += 2;
				}
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified ${checks} native name-plan epoch checks across three apply/withdraw cycles without reparsing a previous provider document; fixture rolled back`,
	);
} finally {
	await pool.end();
}
