import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";
import { users } from "@rezics/schema/postgres/identity/auth";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import { softwareParticipationRevision } from "@rezics/schema/postgres/software/software-participation";
import { adoptVndbStaff } from "../src/services/catalog/vndb-entities";
import { adoptVndbVn } from "../src/services/catalog/vndb-adoption";
import {
	readSoftwareParticipations,
	reviseSoftwareParticipation,
	restoreSoftwareParticipation,
} from "../src/services/catalog/software-participation";
import {
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { VndbCatalogContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Requires a loopback disposable Atlas database");
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
	id: "s990001",
	aid: 990001,
	ismain: true,
	name: "Original Name",
	original: null,
	lang: "en",
	aliases: [
		{ aid: 990001, ismain: true, name: "Original Name", latin: null },
		{ aid: 990002, ismain: false, name: "Stage Name", latin: null },
	],
};
const vn = {
	id: "v990001",
	title: "Participation fixture",
	editions: [{ eid: 8, lang: "ta", name: "Translation staff", official: false }],
	staff: [{ id: staff.id, aid: 990002, eid: 8, role: "translator", note: "Translation credit" }],
	va: [{ staff: { id: staff.id, aid: 990001 }, character: { id: "c990001" }, note: null }],
};
const staffBytes = Buffer.from(JSON.stringify(staff));
const vnBytes = Buffer.from(JSON.stringify(vn));
const staffReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(staff.id),
	staffBytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const vnReceipt = await storeCatalogSourcePayload(
	vndbSourceKey(vn.id),
	vnBytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback participation fixture");
let assertions = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({ name: "Participation fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(actor);
			for (const routingBucket of new Set(
				[staff.id, vn.id, "c990001"].map((id) =>
					aggregateRoutingBucket("source_record", catalogSourceRecordId(vndbSourceKey(id))),
				),
			))
				await tx
					.insert(operationalCapacity)
					.values(
						["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
							routingBucket,
							lane,
							maximumRows: 1000n,
							maximumBytes: 64_000_000n,
						})),
					)
					.onConflictDoNothing();

			await assert.rejects(
				tx.transaction((inner) => adoptVndbVn(inner, actor.id, vnReceipt, vnBytes)),
				/alias dependency/,
			);
			assertions++;
			const person = await adoptVndbStaff(tx, actor.id, staffReceipt, staffBytes);
			assert.equal(person.status, "created");
			const content = await adoptVndbVn(tx, actor.id, vnReceipt, vnBytes);
			assert.equal(content.status, "created");
			if (content.status !== "created") throw new Error("Expected new software fixture");
			const rows = await readSoftwareParticipations(tx, content.reference, actor.id);
			assert.equal(rows.length, 2);
			assertions++;
			const credit = rows.find((row) => row.contextId !== null);
			const voice = rows.find((row) => row.characterId !== null);
			assert.ok(
				credit?.nameId && credit.nameRevision && credit.contextId && credit.contextRevision,
			);
			assert.ok(voice?.nameId && voice.nameRevision);
			assert.notEqual(credit.nameId, voice.nameId);
			assertions++;
			const named = CatalogNameTables.entity.nameRevision;
			const [alias] = await tx
				.select()
				.from(named)
				.where(
					and(
						eq(named.ownerId, credit.entityId),
						eq(named.id, credit.nameId),
						eq(named.revision, credit.nameRevision),
					),
				)
				.limit(1);
			assert.equal(alias?.value, "Stage Name");
			assertions++;
			const values = {
				entityId: credit.entityId,
				name: { id: credit.nameId, revision: credit.nameRevision },
				context: { id: credit.contextId, revision: credit.contextRevision },
				characterId: null,
				roleRevisionId: credit.roleRevisionId,
				note: "Local edit",
				state: "active" as const,
			};
			const edited = await reviseSoftwareParticipation(
				tx,
				content.reference,
				actor.id,
				credit.participationId,
				credit.revision,
				values,
			);
			await assert.rejects(
				tx.transaction((inner) =>
					reviseSoftwareParticipation(
						inner,
						content.reference,
						actor.id,
						credit.participationId,
						credit.revision,
						values,
					),
				),
				/revision changed/,
			);
			assertions++;
			const restored = await restoreSoftwareParticipation(
				tx,
				content.reference,
				actor.id,
				credit.participationId,
				edited.revision,
				credit.revision,
			);
			assert.equal(restored.revision, 3);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					inner
						.update(softwareParticipationRevision)
						.set({ note: "rewrite history" })
						.where(
							and(
								eq(softwareParticipationRevision.contentId, content.reference.id),
								eq(softwareParticipationRevision.participationId, credit.participationId),
							),
						),
				),
			);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					reviseSoftwareParticipation(
						inner,
						content.reference,
						actor.id,
						credit.participationId,
						restored.revision,
						{ ...values, entityId: voice.characterId ?? crypto.randomUUID() },
					),
				),
				/credited person/,
			);
			assertions++;
			await tx.execute(sql`set constraints all immediate`);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(JSON.stringify({ check: "vndb-participation", assertions, rolledBack: true }));
} finally {
	await pool.end();
}
