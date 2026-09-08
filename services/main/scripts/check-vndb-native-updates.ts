import { runWithNativeFixtureActor } from "./native-fixture-actor";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import {
	softwareRecordRevision,
	softwareReleaseLanguage,
} from "../src/services/database/schema/catalog-software";
import { catalogSourceMappingClaim } from "../src/services/database/schema/catalog-source";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import {
	catalogDefinition,
	catalogDefinitionRevision,
} from "../src/services/database/schema/catalog-identity";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	VndbCatalogContractSha256,
	VndbDumpContractSha256,
	vndbSourceKey,
} from "../src/services/catalog/vndb";
import { adoptVndbDumpRelease } from "../src/services/catalog/vndb-dump";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { adoptVndbRelease } from "../src/services/catalog/vndb-release";
import { createVndbReleaseNativeWriter } from "../src/services/catalog/vndb-release-update";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	readSoftwareDetails,
	readSoftwareReleaseComponents,
	readSoftwareComponentHistory,
	reviseSoftwareRelease,
	decodeSoftwareReleaseSnapshot,
} from "../src/services/catalog/software";
import { putSoftwareComponent } from "../src/services/catalog/software-components";
import {
	ensureCatalogDefinition,
	loadCatalogIdentity,
	findCatalogRelations,
	readCatalogRelationQualifiers,
	readCatalogFactNodes,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Only disposable loopback Atlas databases are admitted");
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		objects.set(value.Key, new Uint8Array(value.Body));
	},
	async get(value) {
		const bytes = objects.get(value.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const original = {
	id: "r970001",
	title: "Release A",
	notes: "Source notes A",
	official: true,
	patch: false,
	platforms: ["win"],
	media: [{ medium: "dvd", qty: 1 }],
	vns: [{ id: "v970001", rtype: "complete" }],
	languages: [{ lang: "ja", title: "作品 A", latin: null, main: true, mtl: false }],
	producers: [{ id: "p970001", developer: true, publisher: true }],
	extlinks: [
		{
			url: "https://example.invalid/release",
			name: "homepage",
			id: "https://example.invalid/release",
			label: "Original homepage",
		},
	],
};
const updated = {
	...original,
	title: "Release B",
	notes: "Source notes B",
	official: false,
	media: [
		{ medium: "dvd", qty: 2 },
		{ medium: "in", qty: 0 },
	],
	languages: [
		{ lang: "ja", title: "作品 B", latin: null, main: true, mtl: false },
		{ lang: "en", title: null, latin: null, main: false, mtl: true },
	],
	producers: [
		{ id: "p970001", developer: true, publisher: false },
		{ id: "p970002", developer: false, publisher: true },
	],
	extlinks: [{ ...original.extlinks[0], label: "Updated homepage" }],
};
const useDump = process.env.REZICS_VNDB_DUMP_FIXTURE === "1";
function dumpRelease(record: typeof original | typeof updated, changed: boolean) {
	return {
		release: {
			id: record.id,
			olang: "ja",
			gtin: "0",
			released: 0,
			voiced: 0,
			reso_x: 0,
			reso_y: 0,
			minage: null,
			patch: record.patch,
			freeware: false,
			uncensored: null,
			official: record.official,
			has_ero: false,
			catalog: "",
			notes: record.notes,
			engine: null,
		},
		titles: record.languages.map((language) => ({
			id: record.id,
			lang: language.lang,
			title: language.title,
			latin: language.main ? record.title : null,
			mtl: language.mtl,
		})),
		platforms: record.platforms.map((platform) => ({ id: record.id, platform })),
		media: record.media.map((medium) => ({ id: record.id, ...medium })),
		vns: record.vns.map((vn) => ({ id: record.id, vid: vn.id, rtype: vn.rtype })),
		producers: record.producers.map((producer) => ({
			id: record.id,
			pid: producer.id,
			developer: producer.developer,
			publisher: producer.publisher,
		})),
		release_images: [
			{
				id: record.id,
				img: "cv970001",
				vid: "v970001",
				itype: changed ? "pkgback" : "pkgfront",
				lang: changed ? ["ja", "en"] : null,
				photo: true,
			},
		],
		images: [
			{
				id: "cv970001",
				width: changed ? 640 : 600,
				height: 400,
				c_votecount: 2,
				c_sexual_avg: 100,
				c_violence_avg: 0,
			},
		],
		links: [{ id: record.id, link: 1 }],
		extlinks: [{ id: 1, site: "website", value: `https://example.invalid/${changed ? "b" : "a"}` }],
	};
}
const firstBytes = Buffer.from(JSON.stringify(useDump ? dumpRelease(original, false) : original)),
	secondBytes = Buffer.from(JSON.stringify(useDump ? dumpRelease(updated, true) : updated));
const firstReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(original.id),
	firstBytes,
	useDump ? VndbDumpContractSha256 : VndbCatalogContractSha256,
	null,
	archive,
);
const secondReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(original.id),
	secondBytes,
	useDump ? VndbDumpContractSha256 : VndbCatalogContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback VNDB native update fixture");
let assertions = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "VNDB native update fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				for (const routingBucket of new Set(
					[original.id, "v970001", "p970001", "p970002", "cv970001"].map((id) =>
						aggregateRoutingBucket(
							"source_record",
							catalogSourceRecordId(
								id.startsWith("cv")
									? { source: "vndb", objectType: "image", externalId: id }
									: vndbSourceKey(id),
							),
						),
					),
				))
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket,
								lane,
								maximumRows: 5000n,
								maximumBytes: 128_000_000n,
							})),
						)
						.onConflictDoNothing();
				const initial = await (useDump ? adoptVndbDumpRelease : adoptVndbRelease)(
					tx,
					actor.id,
					firstReceipt,
					firstBytes,
				);
				assert.equal(initial.status, "created");
				if (initial.status !== "created") throw new Error("Fixture source was already bound");
				const reference = initial.reference;
				const [record] = await tx
					.select()
					.from(softwareRecordRevision)
					.where(eq(softwareRecordRevision.ownerId, reference.id))
					.orderBy(desc(softwareRecordRevision.revision))
					.limit(1);
				assert.ok(record);
				let revision = (
					await reviseSoftwareRelease(tx, reference, actor.id, initial.revision, {
						...decodeSoftwareReleaseSnapshot(record.value),
						catalogNumber: "LOCAL-CATALOG",
					})
				).revision;
				const [language] = await tx
					.select()
					.from(softwareReleaseLanguage)
					.where(eq(softwareReleaseLanguage.releaseId, reference.id))
					.limit(1);
				assert.ok(language);
				const channel = await ensureCatalogDefinition(tx, {
					namespace: "software.language_channel",
					key: "interface",
					kind: "vocabulary",
					valueKind: null,
				});
				const [languageHistory] = await readSoftwareComponentHistory(
					tx,
					reference,
					actor.id,
					"language",
					language.id,
				);
				assert.ok(languageHistory);
				revision = (
					await putSoftwareComponent(
						tx,
						reference,
						actor.id,
						revision,
						language.id,
						languageHistory.revision,
						{
							kind: "language",
							languageTag: language.languageTag,
							channelRevisionId: channel.revisionId,
							machineTranslated: language.machineTranslated,
							main: language.main,
							title: language.title,
							transliteratedTitle: language.transliteratedTitle,
						},
					)
				).revision;
				const second = await recordCatalogSourceObservation(tx, secondReceipt);
				const sourceRecordId = second.record.id;
				const [claim] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(
						and(
							eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
							eq(catalogSourceMappingClaim.path, "/"),
						),
					)
					.limit(1);
				assert.ok(claim);
				const writer = createVndbReleaseNativeWriter({
					before: { snapshotId: initial.snapshotId, receipt: firstReceipt, bytes: firstBytes },
					after: { snapshotId: second.snapshot.id, receipt: secondReceipt, bytes: secondBytes },
				});
				const verifyDumpGraph = async (changed: boolean) => {
					if (!useDump) return;
					const languages = new Set<string>();
					for (const [key, count] of [
						["has-image", changed ? 2 : 1],
						["external-link", 1],
					] as const) {
						const [definition] = await tx
							.select({ id: catalogDefinitionRevision.id })
							.from(catalogDefinition)
							.innerJoin(
								catalogDefinitionRevision,
								eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
							)
							.where(
								and(
									eq(catalogDefinition.namespace, "catalog.semantic-relation"),
									eq(catalogDefinition.key, key),
								),
							)
							.limit(1);
						assert.ok(definition);
						const relations = await findCatalogRelations(tx, reference, actor.id, definition.id);
						assert.equal(relations.length, count);
						assertions++;
						for (const relation of relations)
							for (const qualifier of await readCatalogRelationQualifiers(
								tx,
								reference,
								actor.id,
								relation.id,
							)) {
								const [property] = await tx
									.select({ key: catalogDefinition.key })
									.from(catalogDefinitionRevision)
									.innerJoin(
										catalogDefinition,
										eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
									)
									.where(eq(catalogDefinitionRevision.id, qualifier.definitionRevisionId))
									.limit(1);
								assert.notEqual(property?.key, "is-photograph");
								if (
									!["image-type", "image-source-language", "image-dims-width", "url"].includes(
										property?.key ?? "",
									)
								)
									continue;
								const [value] = await readCatalogFactNodes(
									tx,
									reference,
									actor.id,
									qualifier.valueFactId,
									-1,
									100,
									0,
									relation.id,
								);
								if (property?.key === "image-type")
									assert.equal(value?.textValue, changed ? "pkgback" : "pkgfront");
								if (property?.key === "image-dims-width")
									assert.equal(Number(value?.numberValue), changed ? 640 : 600);
								if (property?.key === "url")
									assert.equal(value?.textValue, `https://example.invalid/${changed ? "b" : "a"}`);
								if (property?.key === "image-source-language" && value?.textValue)
									languages.add(value.textValue);
								assertions++;
							}
					}
					assert.deepEqual([...languages].sort(), changed ? ["en", "ja"] : []);
					assertions++;
				};
				for (let cycle = 0; cycle < 3; cycle++) {
					const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
						sourceRecordId,
						mappingKey: claim.mappingKey,
						snapshotId: second.snapshot.id,
						mappingVersion: "vndb.release.2",
					});
					assert.equal(proposal.status, "proposed");
					if (proposal.status !== "proposed") throw new Error("Expected source proposal");
					const decision = {
						sourceRecordId,
						proposalId: proposal.proposal.id,
						mappingVersion: "vndb.release.2",
						reason: "Reviewed fixture",
					};
					const applied = await decideCatalogSourceProposal(
						tx,
						actor.id,
						{ ...decision, action: "apply" },
						writer,
					);
					assert.equal(applied.status, "applied");
					await verifyDumpGraph(true);
					assertions++;
					const details = await readSoftwareDetails(tx, reference, actor.id);
					assert.equal(details.kind, "release");
					if (details.kind !== "release") throw new Error("Expected release");
					assert.equal(details.value?.notes, "Source notes B");
					assert.equal(details.value?.catalogNumber, "LOCAL-CATALOG");
					assertions++;
					const languages = await tx
						.select()
						.from(softwareReleaseLanguage)
						.where(eq(softwareReleaseLanguage.releaseId, reference.id));
					assert.equal(languages.length, 2);
					assert.equal(
						languages.find((row) => row.languageTag === "ja")?.channelRevisionId,
						channel.revisionId,
					);
					assertions++;
					const withdrawn = await decideCatalogSourceProposal(
						tx,
						actor.id,
						{ ...decision, action: "withdraw" },
						writer,
					);
					assert.equal(withdrawn.status, "withdrawn");
					await verifyDumpGraph(false);
					assertions++;
					const restored = await readSoftwareDetails(tx, reference, actor.id);
					if (restored.kind !== "release") throw new Error("Expected release");
					assert.equal(restored.value?.notes, "Source notes A");
					assert.equal(restored.value?.catalogNumber, "LOCAL-CATALOG");
					assertions++;
					assert.equal(
						(await readSoftwareReleaseComponents(tx, reference, actor.id, "language")).length,
						1,
					);
					assertions++;
					const [restoredClaim] = await tx
						.select()
						.from(catalogSourceMappingClaim)
						.where(
							and(
								eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
								eq(catalogSourceMappingClaim.mappingKey, claim.mappingKey),
							),
						)
						.limit(1);
					assert.equal(restoredClaim?.observedSnapshotId, initial.snapshotId);
					assertions++;
				}
				const name = CatalogNameTables.software.name;
				const [display] = await tx
					.select()
					.from(name)
					.where(and(eq(name.ownerId, reference.id), eq(name.kind, "primary")))
					.limit(1);
				assert.equal(display?.value, "Release A");
				assertions++;
				const latest = await loadCatalogIdentity(tx, reference, actor.id, true);
				assert.ok(latest.revision > revision);
				assertions++;
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			check: "vndb-native-updates",
			surface: useDump ? "dump" : "api",
			assertions,
			cycles: 3,
			rolledBack: true,
		}),
	);
} finally {
	await pool.end();
}
