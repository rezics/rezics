import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { catalogSourceMappingClaim } from "../src/services/database/schema/catalog-source";
import { musicTrackOccurrence } from "../src/services/database/schema/catalog-music";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import { entityCatalogProfileRevision } from "../src/services/database/schema/catalog-entity";
import { referenceCatalogProfileRevision } from "../src/services/database/schema/catalog-reference";
import { readEntityProfile } from "../src/services/catalog/entities";
import { readReferenceProfile } from "../src/services/catalog/references";
import {
	MusicBrainzCatalogContractSha256,
	type MusicBrainzRelease,
} from "../src/services/catalog/musicbrainz";
import { adoptMusicBrainzRelease } from "../src/services/catalog/musicbrainz-adoption";
import { adoptMusicBrainzObject } from "../src/services/catalog/musicbrainz-object-adoption";
import { musicBrainzObjectNativeWriter } from "../src/services/catalog/musicbrainz-object-delta";
import { adoptMusicBrainzAlternativeRelease } from "../src/services/catalog/musicbrainz-alternatives";
import { musicBrainzReleaseNativeWriter } from "../src/services/catalog/musicbrainz-release-delta";
import {
	recordCatalogSourceDocument,
	storeCatalogSourcePayload,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	listMusicMedia,
	readMusicReleaseMetadata,
	listMusicReleasePresentations,
	listMusicMediumPresentations,
	listMusicTrackPresentations,
	listMusicWorkLanguages,
	readMusicRecordingMetadata,
} from "../src/services/catalog/music-domain";
import { readMusicTracks } from "../src/services/catalog/domains";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";
import { listCatalogNames, readCatalogFactNodes } from "../src/services/catalog/storage";
import { listCatalogFacts } from "../src/services/catalog/semantic-history";
import { bindReferencedSourceIdentity } from "../src/services/catalog/source-references";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture configuration required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434") ||
	target.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}`
)
	throw new Error("Music source delta requires isolated fixture");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const rollback = new Error("music source delta fixture rollback");
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const value = objects.get(input.Key);
		return { Body: value ? Readable.from([value]) : undefined };
	},
};
const testNames = process.env.REZICS_MUSIC_SOURCE_NAME_CHANGES === "1";

try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Music source delta fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			const sourceKey = {
				source: "musicbrainz",
				objectType: "release",
				externalId: crypto.randomUUID(),
			};
			const sourceRecordId = catalogSourceRecordId(sourceKey);
			const routingBucket = aggregateRoutingBucket("source_record", sourceRecordId);
			await tx
				.insert(operationalCapacity)
				.values(
					["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
						routingBucket,
						lane,
						maximumRows: 1000n,
						maximumBytes: 64000000n,
					})),
				)
				.onConflictDoNothing();
			const firstTrackId = crypto.randomUUID();
			const secondTrackId = crypto.randomUUID();
			const recordingId = crypto.randomUUID();
			const originalMediumId = crypto.randomUUID();
			const addedTrackId = crypto.randomUUID();
			const artistId = crypto.randomUUID();
			const labelId = crypto.randomUUID();
			const areaId = crypto.randomUUID();
			const previous: MusicBrainzRelease = {
				id: sourceKey.externalId,
				title: "Album before",
				barcode: "111",
				...(testNames ? { annotation: "First annotation" } : {}),
				aliases: [{ name: "Alias before", locale: "en", primary: true }],
				"artist-credit": [
					{
						artist: {
							id: artistId,
							name: "Fixture artist",
							type: "Person",
							aliases: [{ name: "Artist alias", locale: "en" }],
						},
						name: "Fixture artist",
						joinphrase: "",
					},
				],
				media: [
					{
						id: originalMediumId,
						position: 1,
						tracks: [
							{
								id: firstTrackId,
								position: 1,
								number: "A1",
								title: "First",
								length: 120000,
								recording: { id: recordingId, title: "Recording", length: 119000 },
							},
							{
								id: secondTrackId,
								position: 2,
								number: "A2",
								title: "Second",
								recording: { id: recordingId, title: "Recording", length: 119000 },
							},
						],
					},
				],
				"label-info": [
					{
						"catalog-number": "CAT-1",
						label: {
							id: labelId,
							name: "Fixture label",
							type: "Original Production",
							"label-code": 123,
						},
					},
					{
						"catalog-number": "CAT-1",
						label: {
							id: labelId,
							name: "Fixture label",
							type: "Original Production",
							"label-code": 123,
						},
					},
				],
				"release-events": [
					{
						date: "2020-02",
						area: { id: areaId, name: "Fixture area", type: "Country", "iso-3166-1-codes": ["JP"] },
					},
					{
						date: "2020-02",
						area: { id: areaId, name: "Fixture area", type: "Country", "iso-3166-1-codes": ["JP"] },
					},
				],
			};
			const originalBytes = Buffer.from(JSON.stringify(previous));
			const originalReceipt = await storeCatalogSourcePayload(
				sourceKey,
				originalBytes,
				MusicBrainzCatalogContractSha256,
				null,
				archive,
			);
			const initialDocument = await recordCatalogSourceDocument(tx, originalReceipt, originalBytes);
			for (const wrong of ["identity", "revision"] as const)
				await assert.rejects(
					tx.transaction(async (inner) =>
						bindReferencedSourceIdentity(inner, actor.id, {
							source: "musicbrainz",
							objectType: "artist",
							externalId: artistId,
							owner: "entity",
							shape: "unresolved",
							evidence: initialDocument.referenceAt("/artist-credit/0/artist/id"),
							initialize: async (created) => ({
								...created,
								...(wrong === "identity"
									? { id: crypto.randomUUID() }
									: { revision: created.revision + 1 }),
							}),
						}),
					),
					wrong === "identity" ? /another native identity/ : /declared native revision/,
				);
			const adopted = await adoptMusicBrainzRelease(tx, actor.id, originalReceipt, originalBytes);
			assert.equal(adopted.status, "created");
			assert.ok("reference" in adopted);
			const reference = adopted.reference;
			for (const [objectType, externalId, owner] of [
				["artist", artistId, "entity"],
				["label", labelId, "entity"],
				["area", areaId, "reference"],
			] as const) {
				const nestedSourceId = catalogSourceRecordId({
					source: "musicbrainz",
					objectType,
					externalId,
				});
				const bindings = CatalogFactTables[owner].sourceBinding;
				const [nested] = await tx
					.select({
						ownerId: bindings.ownerId,
						baseline: catalogSourceMappingClaim.baselineTargetRevision,
					})
					.from(catalogSourceMappingClaim)
					.innerJoin(
						bindings,
						and(
							eq(bindings.sourceRecordId, catalogSourceMappingClaim.sourceRecordId),
							eq(bindings.mappingKey, catalogSourceMappingClaim.mappingKey),
						),
					)
					.where(eq(catalogSourceMappingClaim.sourceRecordId, nestedSourceId))
					.limit(1);
				assert.ok(nested);
				const profile =
					owner === "entity"
						? await readEntityProfile(tx, { owner, id: nested.ownerId }, actor.id)
						: await readReferenceProfile(tx, { owner, id: nested.ownerId }, actor.id);
				assert.equal(
					nested.baseline,
					profile.revision,
					"Reference baseline must include canonical profile/alias/code initialization",
				);
				const history =
					owner === "entity" ? entityCatalogProfileRevision : referenceCatalogProfileRevision;
				assert.equal(
					(await tx.select().from(history).where(eq(history.ownerId, nested.ownerId))).length,
					1,
				);
			}
			const textFacts = async () => {
				const values: string[] = [];
				for (const fact of await listCatalogFacts(tx, reference, actor.id))
					for (const node of await readCatalogFactNodes(tx, reference, actor.id, fact.id))
						if (node.textValue !== null) values.push(node.textValue);
				return values;
			};
			const [claim] = await tx
				.select()
				.from(catalogSourceMappingClaim)
				.where(
					and(
						eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
						eq(catalogSourceMappingClaim.owner, "music"),
					),
				)
				.limit(1);
			assert.ok(claim?.observedSnapshotId);
			const originalSnapshotId = claim.observedSnapshotId;
			const [medium] = await listMusicMedia(tx, reference, actor.id);
			assert.ok(medium);
			const originalTracks = await readMusicTracks(tx, reference, actor.id, medium.id);
			const incoming: MusicBrainzRelease = {
				...previous,
				title: testNames ? "Album after" : previous.title,
				barcode: "222",
				...(testNames
					? { annotation: "Updated annotation", disambiguation: "New source disambiguation" }
					: {}),
				aliases: testNames
					? [
							{ name: "Alias after", locale: "en", primary: true },
							{ name: "New alias", locale: "de" },
						]
					: previous.aliases,
				media: [
					{
						...previous.media[0]!,
						tracks: [
							{ ...previous.media[0]!.tracks![1]!, position: 1 },
							{ ...previous.media[0]!.tracks![0]!, position: 2, title: "First updated" },
						],
					},
					{
						position: 2,
						tracks: [
							{
								id: addedTrackId,
								position: 1,
								number: "B1",
								title: "Added track",
								recording: { id: recordingId, title: "Recording" },
							},
						],
					},
				],
				"label-info": [{ "catalog-number": "CAT-2" }],
				"release-events": [{ date: "2021" }],
			};
			const incomingBytes = Buffer.from(JSON.stringify(incoming));
			const incomingReceipt = await storeCatalogSourcePayload(
				sourceKey,
				incomingBytes,
				MusicBrainzCatalogContractSha256,
				null,
				archive,
			);
			const incomingObservation = await recordCatalogSourceDocument(
				tx,
				incomingReceipt,
				incomingBytes,
			);
			const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
				sourceRecordId,
				mappingKey: claim.mappingKey,
				snapshotId: incomingObservation.snapshot.id,
				mappingVersion: "musicbrainz.release.1",
			});
			assert.equal(proposal.status, "proposed");
			assert.ok("proposal" in proposal);
			const writer = musicBrainzReleaseNativeWriter(
				{ receipt: originalReceipt, bytes: originalBytes },
				{ receipt: incomingReceipt, bytes: incomingBytes },
			);
			const decision = await decideCatalogSourceProposal(
				tx,
				actor.id,
				{
					sourceRecordId,
					proposalId: proposal.proposal.id,
					mappingVersion: "musicbrainz.release.1",
					action: "apply",
					reason: "Reviewed exact structural delta",
				},
				writer,
			);
			assert.equal(decision.status, "applied");
			const updated = await readMusicTracks(tx, reference, actor.id, medium.id);
			assert.deepEqual(
				updated.map((row) => row.id),
				[originalTracks[1]!.id, originalTracks[0]!.id],
			);
			assert.equal(updated[1]?.name, "First updated");
			assert.equal((await listMusicMedia(tx, reference, actor.id)).length, 2);
			assert.equal((await readMusicReleaseMetadata(tx, reference, actor.id)).barcode, "222");
			assert.equal(
				(await listCatalogNames(tx, reference, actor.id)).find(
					(row) => row.kind === "source-primary",
				)?.value,
				incoming.title,
			);
			if (testNames)
				assert.deepEqual((await textFacts()).sort(), [
					"New source disambiguation",
					"Updated annotation",
				]);
			const application = await readCatalogSourceApplication(tx, actor.id, {
				sourceRecordId,
				proposalId: proposal.proposal.id,
				action: "apply",
			});
			assert.ok(application && application.changes.length >= 7);
			await tx
				.transaction(async (inner) => {
					await inner
						.update(musicTrackOccurrence)
						.set({ name: "Protected human correction" })
						.where(eq(musicTrackOccurrence.id, originalTracks[0]!.id));
					await assert.rejects(
						decideCatalogSourceProposal(
							inner,
							actor.id,
							{
								sourceRecordId,
								proposalId: proposal.proposal.id,
								mappingVersion: "musicbrainz.release.1",
								action: "withdraw",
								reason: "Must preserve human edit",
							},
							writer,
						),
						/component revision changed/,
					);
					await inner.rollback();
				})
				.catch((error) => {
					if (error?.constructor?.name !== "TransactionRollbackError") throw error;
				});
			const withdrawn = await decideCatalogSourceProposal(
				tx,
				actor.id,
				{
					sourceRecordId,
					proposalId: proposal.proposal.id,
					mappingVersion: "musicbrainz.release.1",
					action: "withdraw",
					reason: "Restore exact previous adoption",
				},
				writer,
			);
			assert.equal(withdrawn.status, "withdrawn");
			assert.equal((await readMusicReleaseMetadata(tx, reference, actor.id)).barcode, "111");
			assert.equal((await listMusicMedia(tx, reference, actor.id)).length, 1);
			assert.deepEqual(
				(await readMusicTracks(tx, reference, actor.id, medium.id)).map((row) => row.id),
				originalTracks.map((row) => row.id),
			);
			assert.equal(
				(await listCatalogNames(tx, reference, actor.id)).find(
					(row) => row.kind === "source-primary",
				)?.value,
				"Album before",
			);
			if (testNames) assert.deepEqual(await textFacts(), ["First annotation"]);
			const [after] = await tx
				.select()
				.from(catalogSourceMappingClaim)
				.where(
					and(
						eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
						eq(catalogSourceMappingClaim.mappingKey, claim.mappingKey),
					),
				)
				.limit(1);
			assert.equal(after?.observedSnapshotId, originalSnapshotId);
			for (let cycle = 0; cycle < 3; cycle++) {
				const repeat = await proposeCatalogSourceAdoption(tx, actor.id, {
					sourceRecordId,
					mappingKey: claim.mappingKey,
					snapshotId: incomingObservation.snapshot.id,
					mappingVersion: "musicbrainz.release.1",
				});
				assert.ok("proposal" in repeat);
				assert.ok(repeat.proposal);
				await decideCatalogSourceProposal(
					tx,
					actor.id,
					{
						sourceRecordId,
						proposalId: repeat.proposal.id,
						mappingVersion: "musicbrainz.release.1",
						action: "apply",
						reason: "Reapply exact archived source after compensation",
					},
					writer,
				);
				assert.equal((await readMusicReleaseMetadata(tx, reference, actor.id)).barcode, "222");
				await decideCatalogSourceProposal(
					tx,
					actor.id,
					{
						sourceRecordId,
						proposalId: repeat.proposal.id,
						mappingVersion: "musicbrainz.release.1",
						action: "withdraw",
						reason: "Repeat exact compensation without journal-chain traversal",
					},
					writer,
				);
				assert.equal((await readMusicReleaseMetadata(tx, reference, actor.id)).barcode, "111");
			}
			const alternativeKey = {
				source: "musicbrainz",
				objectType: "alternative_release",
				externalId: crypto.randomUUID(),
			};
			const alternativeBucket = aggregateRoutingBucket(
				"source_record",
				catalogSourceRecordId(alternativeKey),
			);
			await tx
				.insert(operationalCapacity)
				.values(
					["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
						routingBucket: alternativeBucket,
						lane,
						maximumRows: 1000n,
						maximumBytes: 64000000n,
					})),
				)
				.onConflictDoNothing();
			const alternative = {
				id: 1,
				gid: alternativeKey.externalId,
				release: { id: 2, gid: sourceKey.externalId },
				name: "別表記",
				type: { gid: crypto.randomUUID(), name: "Translation" },
				language: "jpn",
				script: "Jpan",
				comment: "",
				media: [
					{
						id: 3,
						alternative_release: 1,
						medium: { id: 4, gid: originalMediumId, release: 2 },
						name: "日本語",
						tracks: [firstTrackId, secondTrackId].map((gid, index) => ({
							alternative_medium: 3,
							track: { id: 5 + index, gid, medium: 4 },
							alternative_track: { id: 10, name: "共通の別表記" },
						})),
					},
				],
			};
			const alternativeBytes = Buffer.from(JSON.stringify(alternative));
			const alternativeReceipt = await storeCatalogSourcePayload(
				alternativeKey,
				alternativeBytes,
				MusicBrainzCatalogContractSha256,
				null,
				archive,
			);
			const alternativeResult = await adoptMusicBrainzAlternativeRelease(
				tx,
				reference,
				actor.id,
				(await readMusicReleaseMetadata(tx, reference, actor.id)).revision,
				alternativeReceipt,
				alternativeBytes,
			);
			assert.equal(alternativeResult.status, "created");
			const [presentation] = await listMusicReleasePresentations(tx, reference, actor.id);
			assert.ok(presentation);
			assert.equal(presentation.languageTag, "ja");
			const [presentedMedium] = await listMusicMediumPresentations(
				tx,
				reference,
				actor.id,
				presentation.id,
			);
			assert.ok(presentedMedium);
			const alternateTracks = await listMusicTrackPresentations(
				tx,
				reference,
				actor.id,
				presentedMedium.id,
			);
			assert.equal(alternateTracks.length, 2);
			assert.equal(alternateTracks[0]?.alternativeTrackId, alternateTracks[1]?.alternativeTrackId);
			assert.equal(alternateTracks[0]?.name, "共通の別表記");
			assert.equal((await readMusicTracks(tx, reference, actor.id, medium.id)).length, 2);
			for (const kind of ["work", "recording", "release_group"] as const) {
				const objectKey = {
					source: "musicbrainz",
					objectType: kind,
					externalId: crypto.randomUUID(),
				};
				const objectRecordId = catalogSourceRecordId(objectKey);
				const bucket = aggregateRoutingBucket("source_record", objectRecordId);
				await tx
					.insert(operationalCapacity)
					.values(
						["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
							routingBucket: bucket,
							lane,
							maximumRows: 1000n,
							maximumBytes: 64000000n,
						})),
					)
					.onConflictDoNothing();
				const oldValue = {
					id: objectKey.externalId,
					title: "Independent music object",
					...(kind === "work"
						? {
								languages: ["en"],
								...(testNames
									? { attributes: [{ type: "Catalogue number", value: "Op. 1" }] }
									: {}),
							}
						: kind === "recording"
							? { length: 120000, video: false }
							: {
									"primary-type": "Album",
									"secondary-types": ["Compilation"],
									...(testNames ? { "first-release-date": "2020" } : {}),
								}),
				};
				const newValue = {
					id: objectKey.externalId,
					title: "Independent music object",
					...(kind === "work"
						? {
								languages: ["ja"],
								type: "Song",
								...(testNames
									? { attributes: [{ type: "Catalogue number", value: "Op. 2" }] }
									: {}),
							}
						: kind === "recording"
							? { length: 125000, video: true }
							: {
									"primary-type": "EP",
									"secondary-types": ["Soundtrack"],
									...(testNames ? { "first-release-date": "2021-02" } : {}),
								}),
				};
				const oldBytes = Buffer.from(JSON.stringify(oldValue));
				const oldReceipt = await storeCatalogSourcePayload(
					objectKey,
					oldBytes,
					MusicBrainzCatalogContractSha256,
					null,
					archive,
				);
				const object = await adoptMusicBrainzObject(tx, actor.id, oldReceipt, oldBytes);
				assert.equal(object.status, "created");
				assert.ok("reference" in object);
				const [binding] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(
						and(
							eq(catalogSourceMappingClaim.sourceRecordId, objectRecordId),
							eq(catalogSourceMappingClaim.owner, "music"),
						),
					)
					.limit(1);
				assert.ok(binding?.observedSnapshotId);
				const newBytes = Buffer.from(JSON.stringify(newValue));
				const newReceipt = await storeCatalogSourcePayload(
					objectKey,
					newBytes,
					MusicBrainzCatalogContractSha256,
					null,
					archive,
				);
				const observed = await recordCatalogSourceDocument(tx, newReceipt, newBytes);
				const objectWriter = musicBrainzObjectNativeWriter(
					{ receipt: oldReceipt, bytes: oldBytes },
					{ receipt: newReceipt, bytes: newBytes },
				);
				for (let cycle = 0; cycle < 2; cycle++) {
					const proposed = await proposeCatalogSourceAdoption(tx, actor.id, {
						sourceRecordId: objectRecordId,
						mappingKey: binding.mappingKey,
						snapshotId: observed.snapshot.id,
						mappingVersion: `musicbrainz.${kind}.2`,
					});
					assert.ok("proposal" in proposed);
					assert.ok(proposed.proposal);
					const applied = await decideCatalogSourceProposal(
						tx,
						actor.id,
						{
							sourceRecordId: objectRecordId,
							proposalId: proposed.proposal.id,
							mappingVersion: `musicbrainz.${kind}.2`,
							action: "apply",
							reason: "Apply independent music object",
						},
						objectWriter,
					);
					assert.equal(applied.status, "applied");
					if (kind === "work")
						assert.deepEqual(
							(await listMusicWorkLanguages(tx, object.reference, actor.id)).map(
								(row) => row.languageTag,
							),
							["ja"],
						);
					if (kind === "recording") {
						const recording = await readMusicRecordingMetadata(tx, object.reference, actor.id);
						assert.equal(recording.lengthMilliseconds, 125000);
						assert.equal(recording.video, true);
					}
					const removed = await decideCatalogSourceProposal(
						tx,
						actor.id,
						{
							sourceRecordId: objectRecordId,
							proposalId: proposed.proposal.id,
							mappingVersion: `musicbrainz.${kind}.2`,
							action: "withdraw",
							reason: "Compensate independent music object",
						},
						objectWriter,
					);
					assert.equal(removed.status, "withdrawn");
					if (kind === "work")
						assert.deepEqual(
							(await listMusicWorkLanguages(tx, object.reference, actor.id)).map(
								(row) => row.languageTag,
							),
							["en"],
						);
					if (kind === "recording") {
						const recording = await readMusicRecordingMetadata(tx, object.reference, actor.id);
						assert.equal(recording.lengthMilliseconds, 120000);
						assert.equal(recording.video, false);
					}
				}
			}
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified archived release proposal application, duplicate source rows, track identity/reorder, ${testNames ? "title/alias edits, " : ""}protected child correction, withdrawal, prior snapshot restoration and repeated apply/compensate cycles; fixture rolled back`,
	);
} finally {
	await pool.end();
}
