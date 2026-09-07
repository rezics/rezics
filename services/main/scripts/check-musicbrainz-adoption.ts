import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { catalogSourceRecord } from "../src/services/database/schema/catalog-source";
import {
	musicMedium,
	musicRecording,
	musicTrackOccurrence,
} from "../src/services/database/schema/catalog-music";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzReleaseSchema,
	musicBrainzSourceKey,
} from "../src/services/catalog/musicbrainz";
import { adoptMusicBrainzRelease } from "../src/services/catalog/musicbrainz-adoption";
import {
	readMusicReleaseMetadata,
	listMusicMedia,
	listMusicReleaseLabels,
	listMusicReleaseEvents,
} from "../src/services/catalog/music-domain";
import {
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
	recordCatalogSourceDocument,
} from "../src/services/catalog/source-observations";
import { bindReferencedSourceIdentity } from "../src/services/catalog/source-references";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}` ||
	url.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434")
)
	throw new Error("MusicBrainz acceptance requires explicitly selected isolated PostgreSQL");
const response = await fetch(
	"https://musicbrainz.org/ws/2/release/f922ec87-4758-421d-a839-3193455345ff?fmt=json&inc=recordings+artist-credits+release-groups+labels+discids",
	{
		headers: { "User-Agent": "REZICS-CatalogSchema/2026.09.07 (+https://www.rezics.com)" },
		signal: AbortSignal.timeout(30_000),
	},
);
if (!response.ok || !response.body)
	throw new Error(`MusicBrainz release read returned ${response.status}`);
const chunks: Uint8Array[] = [];
let length = 0;
for await (const chunk of response.body) {
	length += chunk.length;
	if (length > 8_000_000) throw new RangeError("MusicBrainz record exceeds fixture budget");
	chunks.push(chunk);
}
const bytes = Buffer.concat(chunks);
const original = MusicBrainzReleaseSchema.parse(JSON.parse(bytes.toString("utf8")));
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
	musicBrainzSourceKey("release", original.id),
	bytes,
	MusicBrainzCatalogContractSha256,
	null,
	archive,
);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback MusicBrainz acceptance");
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
								eq(catalogSourceRecord.source, "musicbrainz"),
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
				.values({ name: "Music source fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			const document = await recordCatalogSourceDocument(tx, receipt, bytes);
			const evidence = document.referenceAt("/media/0/tracks/0/recording/id");
			assert.throws(() => document.referenceAt("/media/00/tracks/0/recording/id"));
			await assert.rejects(
				bindReferencedSourceIdentity(tx, account.id, {
					source: "musicbrainz",
					objectType: "recording",
					externalId: crypto.randomUUID(),
					owner: "music",
					shape: "recording",
					evidence,
				}),
				/differs from its recorded evidence/,
			);
			await assert.rejects(
				bindReferencedSourceIdentity(tx, account.id, {
					source: "musicbrainz",
					objectType: "recording",
					externalId: evidence.externalId,
					owner: "music",
					shape: "recording",
					evidence: { ...evidence },
				}),
				/not issued/,
			);
			const result = await adoptMusicBrainzRelease(tx, account.id, receipt, bytes);
			assert.equal(result.status, "created");
			const [record] = await tx
				.select()
				.from(catalogSourceRecord)
				.where(
					and(
						eq(catalogSourceRecord.source, "musicbrainz"),
						eq(catalogSourceRecord.objectType, "release"),
						eq(catalogSourceRecord.externalId, original.id),
					),
				)
				.limit(1);
			assert.ok(record);
			const native = await readMusicReleaseMetadata(tx, result.reference, account.id);
			assert.equal(native.barcode, original.barcode ?? null);
			assert.equal(native.scriptCode, original["text-representation"]?.script ?? null);
			assert.equal(
				(await listMusicMedia(tx, result.reference, account.id)).length,
				original.media.length,
			);
			assert.equal(
				(await listMusicReleaseLabels(tx, result.reference, account.id)).length,
				original["label-info"]?.length ?? 0,
			);
			assert.equal(
				(await listMusicReleaseEvents(tx, result.reference, account.id)).length,
				original["release-events"]?.length ?? (original.date ? 1 : 0),
			);
			const media = await tx
				.select()
				.from(musicMedium)
				.where(eq(musicMedium.releaseId, result.reference.id));
			assert.equal(media.length, original.media.length);
			const tracks = await tx
				.select({
					number: musicTrackOccurrence.number,
					length: musicTrackOccurrence.lengthMilliseconds,
					recordingLength: musicRecording.lengthMilliseconds,
				})
				.from(musicTrackOccurrence)
				.innerJoin(musicRecording, eq(musicRecording.id, musicTrackOccurrence.recordingId))
				.where(eq(musicTrackOccurrence.releaseId, result.reference.id))
				.orderBy(musicTrackOccurrence.position);
			assert.equal(
				tracks.length,
				original.media.reduce(
					(total, medium) =>
						total +
						(medium.tracks?.length ?? 0) +
						(medium["data-tracks"]?.length ?? 0) +
						(medium.pregap ? 1 : 0),
					0,
				),
			);
			assert.equal(tracks[0]?.number, original.media[0]?.tracks?.[0]?.number);
			assert.equal(tracks[0]?.length, original.media[0]?.tracks?.[0]?.length);
			assert.equal(tracks[0]?.recordingLength, original.media[0]?.tracks?.[0]?.recording.length);
			assert.equal(
				(await adoptMusicBrainzRelease(tx, account.id, receipt, bytes)).reference.id,
				result.reference.id,
			);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified MusicBrainz ${original.id}: canonical physical metadata, media/tracks, independent recording lengths, inline identity evidence and repeat identity; all fixture rows rolled back`,
	);
} finally {
	await pool.end();
}
