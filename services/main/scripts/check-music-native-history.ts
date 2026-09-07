import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	musicComponentRevision,
	musicDiscToc,
	musicDiscTocOffset,
	musicMediumToc,
} from "../src/services/database/schema/catalog-music";
import { createMusicRelease, addMusicMedium } from "../src/services/catalog/domains";
import {
	editMusicReleaseMetadata,
	readMusicReleaseMetadata,
} from "../src/services/catalog/music-domain";
import {
	createMusicReleaseCandidate,
	addMusicCandidateTrack,
	attachMusicCandidateToc,
	readMusicReleaseCandidate,
	listMusicCandidateTracks,
	listMusicCandidateTocs,
} from "../src/services/catalog/music-candidates";
import {
	listMusicComponentRevisions,
	restoreMusicReleaseMetadata,
} from "../src/services/catalog/music-history";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture configuration required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434") ||
	target.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}`
)
	throw new Error("Music history requires the explicitly selected isolated fixture");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("music history fixture rollback");
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({ name: "Music history fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(actor);
			const release = await createMusicRelease(tx, actor.id, {
				name: { languageTag: "en", value: "Physical release" },
			});
			let revision = (
				await editMusicReleaseMetadata(tx, release, actor.id, release.revision, { barcode: "123" })
			).revision;
			const old = (
				await listMusicComponentRevisions(tx, release, actor.id, "music_release", release.id)
			).find((row) => row.value.barcode === "123");
			assert.ok(old);
			revision = (
				await editMusicReleaseMetadata(tx, release, actor.id, revision, { barcode: "456" })
			).revision;
			revision = (await restoreMusicReleaseMetadata(tx, release, actor.id, revision, old.id))
				.revision;
			assert.equal((await readMusicReleaseMetadata(tx, release, actor.id)).barcode, "123");
			assert.equal(
				(await listMusicComponentRevisions(tx, release, actor.id, "music_release", release.id))
					.length,
				4,
			);
			await assert.rejects(
				tx.transaction(async (inner) => {
					await inner
						.update(musicComponentRevision)
						.set({ operation: "DELETE" })
						.where(eq(musicComponentRevision.ownerId, release.id));
				}),
			);
			const medium = await addMusicMedium(tx, release, actor.id, revision, { position: 1 });
			const [toc] = await tx
				.insert(musicDiscToc)
				.values({ trackCount: 2, leadoutOffset: 30000 })
				.returning({ id: musicDiscToc.id });
			assert.ok(toc);
			await tx.insert(musicDiscTocOffset).values({ tocId: toc.id, position: 0, offset: 150 });
			await assert.rejects(
				tx.transaction(async (inner) => {
					await inner
						.insert(musicMediumToc)
						.values({ releaseId: release.id, mediumId: medium.id, tocId: toc.id });
				}),
			);
			await tx.insert(musicDiscTocOffset).values({ tocId: toc.id, position: 1, offset: 15000 });
			await tx
				.insert(musicMediumToc)
				.values({ releaseId: release.id, mediumId: medium.id, tocId: toc.id });
			await assert.rejects(
				tx.transaction(async (inner) => {
					await inner
						.insert(musicDiscTocOffset)
						.values({ tocId: toc.id, position: 2, offset: 20000 });
				}),
			);
			const candidate = await createMusicReleaseCandidate(tx, actor.id, {
				name: "Unknown disc",
				creditedArtistText: null,
			});
			let candidateRevision = (
				await addMusicCandidateTrack(tx, candidate, actor.id, candidate.revision, {
					position: 1,
					name: "",
				})
			).revision;
			candidateRevision = (
				await attachMusicCandidateToc(tx, candidate, actor.id, candidateRevision, {
					offsets: [150],
					leadoutOffset: 30000,
				})
			).revision;
			assert.equal(
				(await readMusicReleaseCandidate(tx, candidate, actor.id)).revision,
				candidateRevision,
			);
			assert.equal((await listMusicCandidateTracks(tx, candidate, actor.id))[0]?.name, "");
			assert.equal((await listMusicCandidateTocs(tx, candidate, actor.id)).length, 1);
			const plan = await tx.execute(
				sql`explain (format json) select * from music_component_revision where owner_id = ${release.id}::uuid and component = 'music_release' and component_key = ${release.id} order by component_sequence limit 100`,
			);
			assert.ok(plan.rows.length);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		"Verified native music metadata history/restore, immutable history, sealed complete TOCs and incomplete candidates; all rows rolled back",
	);
} finally {
	await pool.end();
}
