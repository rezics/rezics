import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	softwareParticipationSourceOccurrence,
	softwareVisualNovel,
} from "../src/services/database/schema/catalog-software";
import { catalogSourceRecord } from "../src/services/database/schema/catalog-source";
import {
	VndbCatalogContractSha256,
	VndbVnSchema,
	vndbSourceKey,
} from "../src/services/catalog/vndb";
import { adoptVndbVn } from "../src/services/catalog/vndb-adoption";
import { exportVndbVn } from "../src/services/catalog/source-export";
import { reviseSoftwareParticipationContext } from "../src/services/catalog/software-contexts";
import {
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	(!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname) &&
		(url.pathname !== "/rezics" || url.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")))
)
	throw new Error("VNDB acceptance requires rezics-dev PostgreSQL");

const response = await fetch("https://api.vndb.org/kana/vn", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"User-Agent": "edge/REZICS-schema-audit (2026.09.07; +https://www.rezics.com)",
	},
	signal: AbortSignal.timeout(30_000),
	body: JSON.stringify({
		filters: ["id", "=", "v17"],
		fields:
			"id,title,titles.lang,titles.title,titles.latin,titles.official,titles.main,aliases,olang,platforms,languages,released,length,length_minutes,devstatus,editions.eid,editions.lang,editions.name,editions.official,staff.id,staff.aid,staff.name,staff.original,staff.eid,staff.role,staff.note,va.staff.id,va.staff.aid,va.character.id,va.note",
		results: 1,
	}),
});
if (!response.ok || !response.body)
	throw new Error(`VNDB public query returned ${response.status}`);
const chunks: Uint8Array[] = [];
let length = 0;
for await (const chunk of response.body) {
	length += chunk.length;
	if (length > 8_000_000) throw new RangeError("VNDB response exceeds fixture budget");
	chunks.push(chunk);
}
const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
if (
	!result ||
	typeof result !== "object" ||
	!("results" in result) ||
	!Array.isArray(result.results) ||
	result.results.length !== 1
)
	throw new Error("VNDB query did not return the selected record");
const original = VndbVnSchema.parse(result.results[0]);
const bytes = Buffer.from(JSON.stringify(original));
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const data = objects.get(input.Key);
		return { Body: data ? Readable.from([data]) : undefined };
	},
};
const receipt = await storeCatalogSourcePayload(
	vndbSourceKey(original.id),
	bytes,
	VndbCatalogContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback VNDB acceptance");
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
								eq(catalogSourceRecord.source, "vndb"),
								eq(catalogSourceRecord.externalId, original.id),
							),
						)
						.limit(1)
				).length,
				0,
				"Fixture must not reuse an adopted source record",
			);
			const [account] = await tx
				.insert(users)
				.values({ name: "VNDB source fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			const adopted = await adoptVndbVn(tx, account.id, receipt, bytes);
			assert.equal(adopted.status, "created");
			const [record] = await tx
				.select()
				.from(catalogSourceRecord)
				.where(
					and(
						eq(catalogSourceRecord.source, "vndb"),
						eq(catalogSourceRecord.externalId, original.id),
					),
				)
				.limit(1);
			assert.ok(record);
			assert.deepEqual(
				await exportVndbVn(tx, adopted.reference, account.id, record.id, adopted.snapshotId),
				original,
			);
			assert.equal(
				(
					await tx
						.select()
						.from(softwareVisualNovel)
						.where(eq(softwareVisualNovel.id, adopted.reference.id))
				).length,
				1,
			);
			const occurrences = await tx
				.select()
				.from(softwareParticipationSourceOccurrence)
				.where(eq(softwareParticipationSourceOccurrence.contentId, adopted.reference.id));
			assert.deepEqual(
				occurrences.map(({ localKey }) => localKey).sort(),
				(original.editions ?? []).map(({ eid }) => String(eid)).sort(),
			);
			assert.equal(
				(await adoptVndbVn(tx, account.id, receipt, bytes)).reference.id,
				adopted.reference.id,
			);
			const firstOccurrence = occurrences[0];
			if (firstOccurrence) {
				await reviseSoftwareParticipationContext(
					tx,
					adopted.reference,
					account.id,
					firstOccurrence.contextId,
					1,
					{ label: "Locally revised participation", languageTag: "fr", state: "withdrawn" },
				);
				assert.deepEqual(
					await exportVndbVn(tx, adopted.reference, account.id, record.id, adopted.snapshotId),
					original,
					"Source observation export preserves original claims after a native context edit",
				);
			}
			const updatedBytes = Buffer.from(
				JSON.stringify({
					...original,
					title: `${original.title} (changed source snapshot)`,
					editions: (original.editions ?? []).map((edition) => ({
						...edition,
						name: `${edition.name} (changed observation)`,
					})),
				}),
			);
			const updatedReceipt = await storeCatalogSourcePayload(
				vndbSourceKey(original.id),
				updatedBytes,
				VndbCatalogContractSha256,
				null,
				archive,
			);
			const proposed = await adoptVndbVn(tx, account.id, updatedReceipt, updatedBytes);
			assert.equal(proposed.status, "review_required");
			assert.equal(
				(
					await tx
						.select()
						.from(softwareParticipationSourceOccurrence)
						.where(eq(softwareParticipationSourceOccurrence.contentId, adopted.reference.id))
				).length,
				occurrences.length,
				"Reused source-local eid cannot silently identify or overwrite native contexts",
			);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified VNDB ${original.id}: selected field roundtrip, VN identity, snapshot-local participation contexts, staff aid/eid/voice context preservation and repeat identity; relation adoption beyond observations remains unqualified`,
	);
} finally {
	await pool.end();
}
