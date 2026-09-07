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
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { VndbCatalogContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";
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
import { ensureCatalogDefinition, loadCatalogIdentity } from "../src/services/catalog/storage";

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
const firstBytes = Buffer.from(JSON.stringify(original)),
	secondBytes = Buffer.from(JSON.stringify(updated));
const firstReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(original.id),
	firstBytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const secondReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(original.id),
	secondBytes,
	VndbCatalogContractSha256,
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
			for (const routingBucket of new Set(
				[original.id, "v970001", "p970001", "p970002"].map((id) =>
					aggregateRoutingBucket("source_record", catalogSourceRecordId(vndbSourceKey(id))),
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
			const initial = await adoptVndbRelease(tx, actor.id, firstReceipt, firstBytes);
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
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ check: "vndb-native-updates", assertions, cycles: 3, rolledBack: true }),
	);
} finally {
	await pool.end();
}
