import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { catalogSourceMappingClaim } from "../src/services/database/schema/catalog-source";
import { softwareParticipationSourceOccurrence } from "../src/services/database/schema/catalog-software";
import {
	catalogDefinition,
	catalogDefinitionRevision,
} from "../src/services/database/schema/catalog-identity";
import {
	findCatalogRelations,
	readCatalogRelationQualifiers,
	readCatalogFactNodes,
} from "../src/services/catalog/storage";
import { listCatalogNameAuthority } from "../src/services/catalog/authority";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { VndbCatalogContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { adoptVndbStaff } from "../src/services/catalog/vndb-entities";
import { adoptVndbVn } from "../src/services/catalog/vndb-adoption";
import { createVndbVnNativeWriter } from "../src/services/catalog/vndb-vn-update";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	readSoftwareParticipations,
	reviseSoftwareParticipation,
} from "../src/services/catalog/software-participation";
import {
	readSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
} from "../src/services/catalog/software-contexts";
import { readSoftwareDetails } from "../src/services/catalog/software";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Requires a disposable loopback Atlas target");
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
const staff = {
	id: "s960001",
	aid: 960001,
	ismain: true,
	name: "Main Name",
	original: null,
	lang: "en",
	aliases: [
		{ aid: 960001, name: "Main Name", latin: null, ismain: true },
		{ aid: 960002, name: "Stage Name", latin: null, ismain: false },
	],
};
const original = {
	id: "v960001",
	title: "Novel A",
	olang: "ja",
	description: "Description A",
	devstatus: 0,
	titles: [{ lang: "ja", title: "作品甲", latin: "Novel A", official: true, main: true }],
	aliases: ["Short title"],
	length_minutes: 100,
	length_votes: 3,
	length: 2,
	editions: [{ eid: 1, lang: "en", name: "English staff", official: false }],
	staff: [
		{
			id: staff.id,
			aid: 960002,
			name: "Stage Name",
			original: null,
			eid: 1,
			role: "translator",
			note: "Initial translation",
		},
	],
	va: [
		{
			staff: { id: staff.id, aid: 960001, name: "Main Name", original: null },
			character: { id: "c960001" },
			note: null,
		},
	],
};
const updated = {
	...original,
	description: "Description B",
	titles: [{ ...original.titles[0], title: "作品乙", official: false }],
	aliases: ["Short title", "New alias"],
	length_minutes: 120,
	length_votes: 5,
	editions: [
		{ eid: 1, lang: "fr", name: "French staff", official: true },
		{ eid: 9, lang: "en", name: "English staff", official: false },
	],
	staff: [
		{
			id: staff.id,
			aid: 960001,
			name: "Main Name",
			original: null,
			eid: 1,
			role: "director",
			note: "French direction",
		},
		{ ...original.staff[0], eid: 9, note: "Revised translation" },
	],
	va: [
		...original.va,
		{
			staff: { id: staff.id, aid: 960001, name: "Main Name", original: null },
			character: { id: "c960002" },
			note: null,
		},
	],
};
const staffBytes = Buffer.from(JSON.stringify(staff)),
	firstBytes = Buffer.from(JSON.stringify(original)),
	secondBytes = Buffer.from(JSON.stringify(updated));
const staffReceipt = await storeCatalogSourcePayload(
		vndbSourceKey(staff.id),
		staffBytes,
		VndbCatalogContractSha256,
		null,
		archive,
	),
	firstReceipt = await storeCatalogSourcePayload(
		vndbSourceKey(original.id),
		firstBytes,
		VndbCatalogContractSha256,
		null,
		archive,
	),
	secondReceipt = await storeCatalogSourcePayload(
		vndbSourceKey(original.id),
		secondBytes,
		VndbCatalogContractSha256,
		null,
		archive,
	);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	db = drizzle({ client: pool }),
	rollback = new Error("rollback VNDB VN updates");
let assertions = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({ name: "VNDB VN update fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(actor);
			for (const routingBucket of new Set(
				[staff.id, original.id, "c960001", "c960002"].map((id) =>
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
			await adoptVndbStaff(tx, actor.id, staffReceipt, staffBytes);
			const first = await adoptVndbVn(tx, actor.id, firstReceipt, firstBytes);
			assert.equal(first.status, "created");
			if (first.status !== "created") throw new Error("Expected created VN");
			const ref = first.reference;
			const [english] = await tx
				.select()
				.from(softwareParticipationSourceOccurrence)
				.where(
					and(
						eq(softwareParticipationSourceOccurrence.contentId, ref.id),
						eq(softwareParticipationSourceOccurrence.snapshotId, first.snapshotId),
					),
				)
				.limit(1);
			assert.ok(english);
			await reviseSoftwareParticipationContext(
				tx,
				ref,
				actor.id,
				english.contextId,
				english.contextRevision,
				{ label: "Locally curated heading", languageTag: "en", state: "active" },
			);
			const second = await recordCatalogSourceObservation(tx, secondReceipt),
				sourceRecordId = second.record.id;
			const [binding] = await tx
				.select()
				.from(catalogSourceMappingClaim)
				.where(
					and(
						eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
						eq(catalogSourceMappingClaim.path, "/"),
					),
				)
				.limit(1);
			assert.ok(binding);
			const writer = createVndbVnNativeWriter({
				before: { snapshotId: first.snapshotId, receipt: firstReceipt, bytes: firstBytes },
				after: { snapshotId: second.snapshot.id, receipt: secondReceipt, bytes: secondBytes },
			});
			const [estimateDefinition] = await tx
				.select({ id: catalogDefinitionRevision.id })
				.from(catalogDefinition)
				.innerJoin(
					catalogDefinitionRevision,
					eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
				)
				.where(
					and(
						eq(catalogDefinition.namespace, "catalog.semantic-relation"),
						eq(catalogDefinition.key, "reported-playtime-estimate"),
					),
				)
				.limit(1);
			assert.ok(estimateDefinition);
			const estimate = async () => {
				const rows = await findCatalogRelations(tx, ref, actor.id, estimateDefinition.id);
				assert.equal(rows.length, 1);
				const relation = rows[0];
				assert.ok(relation);
				const result = new Map<string, string | null>();
				for (const field of await readCatalogRelationQualifiers(tx, ref, actor.id, relation.id)) {
					const [definition] = await tx
						.select({ key: catalogDefinition.key })
						.from(catalogDefinitionRevision)
						.innerJoin(
							catalogDefinition,
							eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
						)
						.where(eq(catalogDefinitionRevision.id, field.definitionRevisionId))
						.limit(1);
					assert.ok(definition);
					const [node] = await readCatalogFactNodes(tx, ref, actor.id, field.valueFactId);
					assert.ok(node);
					result.set(definition.key, node.numberValue ?? node.textValue);
				}
				return result;
			};
			let frenchId: string | undefined;
			for (let cycle = 0; cycle < 3; cycle++) {
				const proposed = await proposeCatalogSourceAdoption(tx, actor.id, {
					sourceRecordId,
					mappingKey: binding.mappingKey,
					snapshotId: second.snapshot.id,
					mappingVersion: "vndb.vn.2",
				});
				assert.equal(proposed.status, "proposed");
				if (proposed.status !== "proposed") throw new Error("Expected proposal");
				const decision = {
					sourceRecordId,
					proposalId: proposed.proposal.id,
					mappingVersion: "vndb.vn.2",
					reason: "Reviewed native fixture",
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
				const current = await readSoftwareDetails(tx, ref, actor.id);
				if (current.kind !== "content") throw new Error("Expected content");
				assert.equal(current.value?.description, "Description B");
				assertions++;
				const playtime = await estimate();
				assert.equal(playtime.get("playtime-estimate-minutes"), "120");
				assert.equal(playtime.get("playtime-sample-count"), "5");
				assert.equal(playtime.get("playtime-estimator"), "reported_average");
				assertions++;
				const credits = await readSoftwareParticipations(tx, ref, actor.id);
				assert.equal(credits.length, 4);
				assertions++;
				const scopes = await tx
					.select()
					.from(softwareParticipationSourceOccurrence)
					.where(
						and(
							eq(softwareParticipationSourceOccurrence.contentId, ref.id),
							eq(softwareParticipationSourceOccurrence.snapshotId, second.snapshot.id),
						),
					);
				const french = scopes.find((row) => row.localKey === "1"),
					renumbered = scopes.find((row) => row.localKey === "9");
				assert.ok(french && renumbered);
				assert.notEqual(french.contextId, english.contextId);
				assert.equal(renumbered.contextId, english.contextId);
				if (frenchId) assert.equal(french.contextId, frenchId);
				frenchId = french.contextId;
				assertions++;
				assert.equal(
					(await readSoftwareParticipationContext(tx, ref, actor.id, english.contextId)).label,
					"Locally curated heading",
				);
				assertions++;
				const names = CatalogNameTables.software.name;
				const [romanized] = await tx
					.select()
					.from(names)
					.where(and(eq(names.ownerId, ref.id), eq(names.kind, "source-transliteration")))
					.limit(1);
				assert.ok(romanized?.derivationNameId && romanized.derivationRevision);
				const histories = CatalogNameTables.software.nameRevision;
				const [derived] = await tx
					.select()
					.from(histories)
					.where(
						and(
							eq(histories.ownerId, ref.id),
							eq(histories.id, romanized.derivationNameId),
							eq(histories.revision, romanized.derivationRevision),
						),
					)
					.limit(1);
				assert.equal(derived?.value, "作品乙");
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
				const restoredEstimate = await estimate();
				assert.equal(restoredEstimate.get("playtime-estimate-minutes"), "100");
				assert.equal(restoredEstimate.get("playtime-sample-count"), "3");
				assertions++;
				const [restoredTitle] = await tx
					.select()
					.from(names)
					.where(
						and(
							eq(names.ownerId, ref.id),
							eq(names.kind, "source-title"),
							eq(names.languageTag, "ja"),
						),
					)
					.limit(1);
				assert.ok(restoredTitle);
				const authority = await listCatalogNameAuthority(
					tx,
					ref,
					actor.id,
					restoredTitle.id,
					restoredTitle.revision,
				);
				assert.ok(
					authority.some(
						(row) =>
							row.claim === "official" &&
							row.reviewState === "source_claim" &&
							row.snapshotId === first.snapshotId,
					),
				);
				assertions++;
				assert.equal((await readSoftwareParticipations(tx, ref, actor.id)).length, 2);
				assertions++;
				assert.equal(
					(await readSoftwareParticipationContext(tx, ref, actor.id, french.contextId)).state,
					"withdrawn",
				);
				assert.equal(
					(await readSoftwareParticipationContext(tx, ref, actor.id, english.contextId)).label,
					"Locally curated heading",
				);
				assertions++;
			}
			const conflicting = await proposeCatalogSourceAdoption(tx, actor.id, {
				sourceRecordId,
				mappingKey: binding.mappingKey,
				snapshotId: second.snapshot.id,
				mappingVersion: "vndb.vn.2",
			});
			if (conflicting.status !== "proposed") throw new Error("Expected conflict proposal");
			const englishCredit = (await readSoftwareParticipations(tx, ref, actor.id)).find(
				(row) => row.contextId === english.contextId,
			);
			assert.ok(englishCredit);
			await reviseSoftwareParticipation(
				tx,
				ref,
				actor.id,
				englishCredit.participationId,
				englishCredit.revision,
				{
					entityId: englishCredit.entityId,
					name:
						englishCredit.nameId && englishCredit.nameRevision
							? { id: englishCredit.nameId, revision: englishCredit.nameRevision }
							: null,
					context:
						englishCredit.contextId && englishCredit.contextRevision
							? { id: englishCredit.contextId, revision: englishCredit.contextRevision }
							: null,
					characterId: englishCredit.characterId,
					roleRevisionId: englishCredit.roleRevisionId,
					note: "Local credit correction",
					state: "active",
				},
			);
			await assert.rejects(
				tx.transaction((inner) =>
					decideCatalogSourceProposal(
						inner,
						actor.id,
						{
							sourceRecordId,
							proposalId: conflicting.proposal.id,
							mappingVersion: "vndb.vn.2",
							action: "apply",
							reason: "Must retain independent credit edit",
						},
						writer,
					),
				),
				/independent native edit/,
			);
			assertions++;
			const preserved = (await readSoftwareParticipations(tx, ref, actor.id)).find(
				(row) => row.participationId === englishCredit.participationId,
			);
			assert.equal(preserved?.note, "Local credit correction");
			const restoredContent = await readSoftwareDetails(tx, ref, actor.id);
			if (restoredContent.kind !== "content") throw new Error("Expected content");
			assert.equal(restoredContent.value?.description, "Description A");
			assertions++;
			await tx.execute(sql`set constraints all immediate`);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ check: "vndb-vn-updates", assertions, cycles: 3, rolledBack: true }),
	);
} finally {
	await pool.end();
}
