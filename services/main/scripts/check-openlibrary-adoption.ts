import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	publishingPublication,
	publishingPublicationWork,
	publishingReleaseEvent,
	publishingTextVersion,
} from "../src/services/database/schema/catalog-publishing";
import { catalogSourceRecord } from "../src/services/database/schema/catalog-source";
import {
	OpenLibraryContractSha256,
	adoptOpenLibraryRecord,
} from "../src/services/catalog/openlibrary-adoption";
import {
	OpenLibraryEditionSchema,
	OpenLibraryWorkSchema,
	openLibrarySourceKey,
} from "../src/services/catalog/openlibrary";
import { exportOpenLibraryRecord } from "../src/services/catalog/source-export";
import {
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const databaseUrl = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) ||
	databaseUrl.pathname !== "/rezics" ||
	databaseUrl.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")
)
	throw new Error("Open Library acceptance requires rezics-dev PostgreSQL");

async function publicBytes(url: string) {
	const response = await fetch(url, {
		headers: { "User-Agent": "edge/REZICS-schema-audit (2026.09.07; +https://www.rezics.com)" },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok || !response.body)
		throw new Error(`Public source read returned ${response.status}`);
	let length = 0;
	const chunks: Uint8Array[] = [];
	for await (const chunk of response.body) {
		length += chunk.length;
		if (length > 8_000_000) throw new RangeError("Source record exceeds the fixture budget");
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

const workBytes = await publicBytes("https://openlibrary.org/works/OL15626917W.json");
const editionBytes = await publicBytes("https://openlibrary.org/books/OL24574991M.json");
const work = OpenLibraryWorkSchema.parse(JSON.parse(workBytes.toString("utf8")));
const edition = OpenLibraryEditionSchema.parse(JSON.parse(editionBytes.toString("utf8")));
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const bytes = objects.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const workReceipt = await storeCatalogSourcePayload(
	openLibrarySourceKey(work.key),
	workBytes,
	OpenLibraryContractSha256,
	null,
	archive,
);
const editionReceipt = await storeCatalogSourcePayload(
	openLibrarySourceKey(edition.key),
	editionBytes,
	OpenLibraryContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback Open Library acceptance");
try {
	try {
		await database.transaction(async (tx) => {
			assert.equal(
				(
					await tx
						.select({ id: catalogSourceRecord.id })
						.from(catalogSourceRecord)
						.where(
							and(
								eq(catalogSourceRecord.source, "openlibrary"),
								eq(catalogSourceRecord.externalId, work.key),
							),
						)
						.limit(1)
				).length,
				0,
				"Fixture must not reuse an adopted source record",
			);
			const [account] = await tx
				.insert(users)
				.values({
					name: "Book-index source fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			await assert.rejects(
				tx.transaction((nested) =>
					adoptOpenLibraryRecord(nested, actor, editionReceipt, editionBytes),
				),
				/Unresolved source Work dependency/,
			);
			const nativeWork = await adoptOpenLibraryRecord(tx, actor, workReceipt, workBytes);
			const nativeEdition = await adoptOpenLibraryRecord(tx, actor, editionReceipt, editionBytes);
			assert.equal(nativeWork.status, "created");
			assert.equal(nativeEdition.status, "created");
			assert.notEqual(nativeWork.reference.id, nativeEdition.reference.id);
			for (const [original, native, kind] of [
				[work, nativeWork, "work"],
				[edition, nativeEdition, "edition"],
			] as const) {
				const [record] = await tx
					.select()
					.from(catalogSourceRecord)
					.where(
						and(
							eq(catalogSourceRecord.source, "openlibrary"),
							eq(catalogSourceRecord.externalId, original.key),
						),
					)
					.limit(1);
				assert.ok(record);
				assert.deepEqual(
					await exportOpenLibraryRecord(
						tx,
						native.reference,
						actor,
						record.id,
						native.snapshotId,
						kind,
					),
					original,
				);
			}
			const [publication] = await tx
				.select()
				.from(publishingPublication)
				.where(eq(publishingPublication.id, nativeEdition.reference.id));
			assert.equal(publication?.pageCount, edition.number_of_pages ?? null);
			assert.equal(publication?.paginationText, edition.pagination ?? null);
			assert.equal(
				(
					await tx
						.select()
						.from(publishingPublicationWork)
						.where(
							and(
								eq(publishingPublicationWork.publicationId, nativeEdition.reference.id),
								eq(publishingPublicationWork.workId, nativeWork.reference.id),
							),
						)
				).length,
				1,
			);
			assert.equal(
				(
					await tx
						.select()
						.from(publishingTextVersion)
						.where(eq(publishingTextVersion.id, nativeEdition.reference.id))
				).length,
				0,
			);
			const events = await tx
				.select()
				.from(publishingReleaseEvent)
				.where(eq(publishingReleaseEvent.publicationId, nativeEdition.reference.id));
			assert.ok(events.length);
			assert.equal(events[0]?.dateYear, 2010);
			assert.equal(events[0]?.dateMonth, null);
			assert.equal(events[0]?.dateDay, null);
			const repeated = await adoptOpenLibraryRecord(tx, actor, editionReceipt, editionBytes);
			assert.equal(repeated.status, "unchanged");
			assert.equal(repeated.reference.id, nativeEdition.reference.id);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		"Verified actual Open Library Work/Edition native field roundtrips, direct Work coverage, partial publication dates, absent invented text-version parents and repeat identity; all fixture rows rolled back",
	);
} finally {
	await pool.end();
}
