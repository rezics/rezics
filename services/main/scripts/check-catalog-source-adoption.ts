import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { programWork } from "../src/services/database/schema/catalog-program";
import {
	catalogSourceAdoptionProposal,
	catalogSourceRecord,
	catalogSourceSnapshot,
} from "../src/services/database/schema/catalog-source";
import { BangumiSubjectContractSha256, parseBangumiSubject } from "../src/services/catalog/bangumi";
import { adoptBangumiSubject } from "../src/services/catalog/source-adoption";
import { exportBangumiSubject } from "../src/services/catalog/source-export";
import { addCatalogName } from "../src/services/catalog/storage";
import {
	readCatalogSourceBytes,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== "/rezics" ||
	url.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")
)
	throw new Error("Source acceptance requires rezics-dev PostgreSQL");

let bytes: Uint8Array;
if (process.argv[2]) bytes = await readFile(process.argv[2]);
else {
	const response = await fetch("https://api.bgm.tv/v0/subjects/253", {
		headers: { "User-Agent": "edge/REZICS-schema-audit (2026.09.07; +https://www.rezics.com)" },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok || !response.body)
		throw new Error(`Bangumi public read returned ${response.status}`);
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const chunk of response.body) {
		length += chunk.length;
		if (length > 8_000_000) throw new RangeError("Source read exceeds its fixture budget");
		chunks.push(chunk);
	}
	bytes = Buffer.concat(chunks);
}
const original = parseBangumiSubject(
	JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
);
const payloads = new Map<string, Uint8Array>();
// Archive transport is isolated in this rollback fixture; native rows are real PostgreSQL.
const archive: CatalogSourceArchive = {
	async put(input) {
		payloads.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const value = payloads.get(input.Key);
		return { Body: value ? Readable.from([value]) : undefined };
	},
};
const sourceKey = { source: "bangumi", objectType: "subject", externalId: String(original.id) };
const firstReceipt = await storeCatalogSourcePayload(
	sourceKey,
	bytes,
	BangumiSubjectContractSha256,
	null,
	archive,
);
const changedBytes = Buffer.from(
	JSON.stringify({ ...original, summary: `${original.summary}\nSource acceptance change` }),
);
const changedReceipt = await storeCatalogSourcePayload(
	sourceKey,
	changedBytes,
	BangumiSubjectContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback source adoption acceptance");
try {
	try {
		await database.transaction(async (tx) => {
			const existing = await tx
				.select({ id: catalogSourceRecord.id })
				.from(catalogSourceRecord)
				.where(
					and(
						eq(catalogSourceRecord.source, sourceKey.source),
						eq(catalogSourceRecord.objectType, sourceKey.objectType),
						eq(catalogSourceRecord.externalId, sourceKey.externalId),
					),
				)
				.limit(1);
			assert.equal(existing.length, 0, "Fixture must not reuse an existing adopted source record");
			const [account] = await tx
				.insert(users)
				.values({
					name: "Source acceptance fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			const initial = await adoptBangumiSubject(
				tx,
				actor,
				firstReceipt,
				await readCatalogSourceBytes(firstReceipt),
			);
			assert.equal(initial.status, "created");
			assert.equal(initial.reference.owner, "program");
			const [record] = await tx
				.select()
				.from(catalogSourceRecord)
				.where(eq(catalogSourceRecord.externalId, sourceKey.externalId))
				.limit(1);
			assert.ok(record);
			const archived = await exportBangumiSubject(firstReceipt);
			assert.deepEqual(
				archived,
				original,
				"Every supplied field must survive immutable source archive export",
			);
			const [program] = await tx
				.select()
				.from(programWork)
				.where(eq(programWork.id, initial.reference.id));
			assert.equal(program?.declaredMainEpisodeCount, original.eps);
			assert.equal(program?.declaredTotalEpisodeCount, original.total_episodes);
			const repeated = await adoptBangumiSubject(tx, actor, firstReceipt, bytes);
			assert.equal(repeated.status, "unchanged");
			assert.equal(repeated.reference.id, initial.reference.id);
			const edited = await addCatalogName(tx, initial.reference, actor, initial.revision, {
				kind: "alias",
				languageTag: "en",
				value: "Protected local correction",
			});
			const changed = await adoptBangumiSubject(tx, actor, changedReceipt, changedBytes);
			assert.equal(changed.status, "review_required");
			assert.equal(changed.revision, edited.revision);
			await adoptBangumiSubject(tx, actor, changedReceipt, changedBytes);
			const proposals = await tx
				.select()
				.from(catalogSourceAdoptionProposal)
				.where(eq(catalogSourceAdoptionProposal.sourceRecordId, record.id));
			assert.equal(proposals.length, 1);
			assert.equal(proposals[0]?.expectedTargetRevision, edited.revision);
			assert.equal(
				(
					await tx
						.select()
						.from(catalogSourceSnapshot)
						.where(eq(catalogSourceSnapshot.sourceRecordId, record.id))
				).length,
				2,
			);
			await assert.rejects(
				tx.transaction((nested) => adoptBangumiSubject(nested, actor, firstReceipt, changedBytes)),
				/differ from the archived/,
			);
			const [outsider] = await tx
				.insert(users)
				.values({ name: "Other source actor", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(outsider);
			await assert.rejects(
				tx.transaction((nested) => adoptBangumiSubject(nested, outsider.id, firstReceipt, bytes)),
				/cannot access/,
			);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified Bangumi subject ${original.id}: native full supplied-field roundtrip, repeat identity, protected local edits, one queued proposal, byte-bound evidence and private-target rejection; all fixture rows rolled back`,
	);
} finally {
	await pool.end();
}
