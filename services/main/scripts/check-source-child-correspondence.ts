import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import {
	catalogSourceMappingClaim as claims,
	catalogSourceBindingRevision as revisions,
} from "@rezics/schema/postgres/ingestion/source";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import { softwareParticipationSourceOccurrence as contexts } from "@rezics/schema/postgres/software/software";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	catalogSourceRecordId,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { VndbCatalogContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";
import { adoptVndbVn, vndbVnDetails } from "../src/services/catalog/vndb-adoption";
import { createNativeSoftwareContent } from "../src/services/catalog/software";
import { recordVndbSoftwareScalarOccurrence } from "../src/services/catalog/vndb-release";
import { softwareRecordSourceOccurrence } from "@rezics/schema/postgres/software/software-source";
import { loadCatalogSourceDocument } from "../src/services/catalog/source-observations";
import { createSoftwareParticipationContext } from "../src/services/catalog/software-contexts";
import {
	addCatalogName,
	bindCatalogNameSourceOccurrence,
	resolveCatalogNameSourceBinding,
} from "../src/services/catalog/names";
import { reviseCatalogSourceBinding } from "../src/services/catalog/source-bindings";
import { resolveCatalogSourceChildCorrespondence } from "../src/services/catalog/source-child-correspondence";
import { loadCatalogIdentity } from "../src/services/catalog/storage";
import { runWithNativeFixtureActor } from "./native-fixture-actor";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)
)
	throw new Error("Requires a disposable loopback Atlas target");
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
const record = {
	id: "v979001",
	title: "Correspondence fixture",
	editions: [{ eid: 1, name: "Staff", lang: "en", official: true }],
};
const bytes = Buffer.from(JSON.stringify(record));
const receipt = await storeCatalogSourcePayload(
	vndbSourceKey(record.id),
	bytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const sourceRecordId = catalogSourceRecordId(vndbSourceKey(record.id));
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback source child correspondence fixture");
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Source correspondence fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning();
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				const routingBucket = aggregateRoutingBucket("source_record", sourceRecordId);
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
				const adopted = await adoptVndbVn(tx, actor.id, receipt, bytes);
				if (adopted.status !== "created") throw new Error("Expected initial VN creation");
				const first = adopted.reference;
				const document = await loadCatalogSourceDocument(
					tx,
					sourceRecordId,
					adopted.snapshotId,
					receipt,
					bytes,
				);
				const secondIdentity = await createNativeSoftwareContent(tx, actor.id, {
					name: { value: "Second target", languageTag: null },
				});
				const second = { owner: "software" as const, id: secondIdentity.id };
				const key = { sourceRecordId, namespace: "vndb.vn.name", localKey: "display" };
				const originalName = await resolveCatalogNameSourceBinding(tx, first, actor.id, key);
				assert.ok(originalName);
				assertions++;
				const initial = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
				let bindingRevision = 1;
				const change = async (
					state: "active" | "paused",
					target?: typeof first,
					mappingVersion?: string,
				) => {
					const result = await reviseCatalogSourceBinding(tx, actor.id, {
						sourceRecordId,
						mappingKey: initial.mappingKey,
						expectedRevision: bindingRevision,
						state,
						mode: "review",
						reason: "Exercise exact child correspondence",
						target,
						mappingVersion,
					});
					bindingRevision = result.revision;
					return resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
				};
				await change("paused");
				const resumed = await change("active");
				assert.deepEqual(resumed, initial);
				assertions++;
				assert.deepEqual(
					await resolveCatalogNameSourceBinding(tx, first, actor.id, key),
					originalName,
				);
				assertions++;
				assert.equal((await adoptVndbVn(tx, actor.id, receipt, bytes)).status, "unchanged");
				assertions++;
				const writeChildren = async (reference: typeof first) => {
					const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
					await recordVndbSoftwareScalarOccurrence(tx, document, reference.id, "/", {
						sourceShape: "content",
						sourceValue: vndbVnDetails(record),
					});
					const native = await loadCatalogIdentity(tx, reference, actor.id, true);
					const name = await addCatalogName(tx, reference, actor.id, native.revision, {
						value: record.title,
						kind: "source-primary",
						languageTag: null,
					});
					await bindCatalogNameSourceOccurrence(tx, reference, actor.id, {
						...key,
						snapshotId: adopted.snapshotId,
						sourcePath: "/title",
						nameId: name.id,
						nameRevision: name.nameRevision,
					});
					const context = await createSoftwareParticipationContext(tx, reference, actor.id, {
						label: "Staff",
						languageTag: "en",
						state: "active",
					});
					await tx.insert(contexts).values({
						...scope,
						sourceRecordId,
						snapshotId: adopted.snapshotId,
						namespace: "editions",
						localKey: "1",
						contentId: reference.id,
						contextId: context.contextId,
						contextRevision: context.revision,
						sourcePointer: "/editions/0",
						sourceLabel: "Staff",
						sourceLanguage: "en",
						sourceLanguageTag: "en",
						sourceClaimedOfficial: true,
					});
					return name.id;
				};
				const rebound = await change("active", second);
				assert.notEqual(rebound.correspondenceRevision, initial.correspondenceRevision);
				assertions++;
				await change("active");
				assert.equal((await adoptVndbVn(tx, actor.id, receipt, bytes)).status, "review_required");
				assertions++;
				assert.equal(await resolveCatalogNameSourceBinding(tx, second, actor.id, key), null);
				assertions++;
				const secondName = await writeChildren(second);
				assert.notEqual(secondName, originalName.nameId);
				assertions++;
				const returned = await change("active", first);
				await change("active");
				assert.notEqual(returned.correspondenceRevision, initial.correspondenceRevision);
				assertions++;
				assert.equal(await resolveCatalogNameSourceBinding(tx, first, actor.id, key), null);
				assertions++;
				const returnedName = await writeChildren(first);
				assert.notEqual(returnedName, originalName.nameId);
				assertions++;
				const protocol = await change("active", undefined, "vndb.vn.3");
				assert.notEqual(protocol.correspondenceRevision, returned.correspondenceRevision);
				assertions++;
				await writeChildren(first);
				const rows = await tx
					.select()
					.from(CatalogNameTables.software.sourceOccurrence)
					.where(
						and(
							eq(CatalogNameTables.software.sourceOccurrence.sourceRecordId, sourceRecordId),
							eq(CatalogNameTables.software.sourceOccurrence.localKey, "display"),
						),
					)
					.orderBy(CatalogNameTables.software.sourceOccurrence.correspondenceRevision);
				assert.equal(rows.length, 4);
				assertions++;
				assert.equal(rows[0]?.nameId, originalName.nameId);
				assertions++;
				assert.equal(new Set(rows.map((row) => row.nameId)).size, 4);
				assertions++;
				assert.equal(
					(await tx.select().from(contexts).where(eq(contexts.sourceRecordId, sourceRecordId)))
						.length,
					4,
				);
				assertions++;
				assert.equal(
					(
						await tx
							.select()
							.from(softwareRecordSourceOccurrence)
							.where(eq(softwareRecordSourceOccurrence.sourceRecordId, sourceRecordId))
					).length,
					4,
				);
				assertions++;
				const [claim] = await tx
					.select()
					.from(claims)
					.where(eq(claims.sourceRecordId, sourceRecordId));
				assert.equal(claim?.appliedCorrespondenceRevision, initial.correspondenceRevision);
				assertions++;
				assert.equal(claim?.correspondenceRevision, protocol.correspondenceRevision);
				assertions++;
				const history = await tx
					.select()
					.from(revisions)
					.where(eq(revisions.sourceRecordId, sourceRecordId))
					.orderBy(revisions.revision);
				assert.equal(history[1]?.correspondenceRevision, 1);
				assertions++;
				assert.equal(history.at(-1)?.correspondenceRevision, bindingRevision);
				assertions++;
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ check: "source-child-correspondence", assertions, rolledBack: true }),
	);
} finally {
	await pool.end();
}
