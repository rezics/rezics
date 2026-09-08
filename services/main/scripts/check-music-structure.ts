import assert from "node:assert/strict";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	musicMedium,
	musicRecording,
	musicTrackOccurrence,
} from "../src/services/database/schema/catalog-music";
import { createCatalogIdentity, ensureCatalogDefinition } from "../src/services/catalog/storage";
import {
	createMusicRelease,
	addMusicMedium,
	addMusicTrack,
	readMusicTracks,
} from "../src/services/catalog/domains";
import {
	mutateMusicComponents,
	readMusicComponentHead,
	compensateMusicComponents,
} from "../src/services/catalog/music-structure";
import type { MusicComponentMutation } from "../src/services/catalog/music-structure-contracts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture configuration required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434") ||
	target.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}`
)
	throw new Error("Music structure requires the selected isolated fixture");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const rollback = new Error("music structure fixture rollback");
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Music structural fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			return runWithNativeFixtureActor(tx,actor.id,async()=>{
			const release = await createMusicRelease(tx, actor.id, {
				name: { languageTag: "en", value: "Physical album" },
			});
			const medium = await addMusicMedium(tx, release, actor.id, release.revision, { position: 1 });
			const first = await addMusicTrack(tx, release, actor.id, medium.revision, {
				mediumId: medium.id,
				position: 1,
				number: "A1",
				name: "First",
			});
			const second = await addMusicTrack(tx, release, actor.id, first.revision, {
				mediumId: medium.id,
				position: 2,
				number: "A2",
				name: "Second",
			});
			const head1 = await readMusicComponentHead(
				tx,
				release.id,
				"music_track_occurrence",
				first.id,
			);
			const head2 = await readMusicComponentHead(
				tx,
				release.id,
				"music_track_occurrence",
				second.id,
			);
			assert.ok(head1 && head2);
			const [otherActor] = await tx
				.insert(users)
				.values({
					name: "Private recording owner",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(otherActor);
			const privateRecording = await createCatalogIdentity(
				tx,
				{ owner: "music", shape: "recording", visibility: "private" },
				otherActor.id,
			);
			await tx.insert(musicRecording).values({ id: privateRecording.id });
			await assert.rejects(
				mutateMusicComponents(tx, release, actor.id, second.revision, [
					{
						action: "put",
						component: "music_track_occurrence",
						componentKey: first.id,
						expectedRevisionId: head1.id,
						value: { ...head1.value, recording_id: privateRecording.id },
					},
				]),
				/cannot access/,
			);
			const wrongSlot = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: crypto.randomUUID(),
				kind: "vocabulary",
				valueKind: null,
				constraints: {
					targets: [{ owner: "music", shapes: ["release"] }],
					slots: ["music_release.status_revision_id"],
				},
			});
			const mediumBefore = await readMusicComponentHead(tx, release.id, "music_medium", medium.id);
			assert.ok(mediumBefore);
			await assert.rejects(
				mutateMusicComponents(tx, release, actor.id, second.revision, [
					{
						action: "put",
						component: "music_medium",
						componentKey: medium.id,
						expectedRevisionId: mediumBefore.id,
						value: { ...mediumBefore.value, format_revision_id: wrongSlot.revisionId },
					},
				]),
				/target or slot/,
			);
			const reorder: MusicComponentMutation[] = [
				{
					action: "put",
					component: "music_track_occurrence",
					componentKey: first.id,
					expectedRevisionId: head1.id,
					value: { ...head1.value, position: 2 },
				},
				{
					action: "put",
					component: "music_track_occurrence",
					componentKey: second.id,
					expectedRevisionId: head2.id,
					value: { ...head2.value, position: 1 },
				},
			];
			const applied = await mutateMusicComponents(tx, release, actor.id, second.revision, reorder);
			assert.deepEqual(
				(await readMusicTracks(tx, release, actor.id, medium.id)).map((row) => row.id),
				[second.id, first.id],
			);
			const restored = await compensateMusicComponents(
				tx,
				release,
				actor.id,
				applied.revision,
				applied.changes,
			);
			assert.deepEqual(
				(await readMusicTracks(tx, release, actor.id, medium.id)).map((row) => row.id),
				[first.id, second.id],
			);
			const current = await readMusicComponentHead(
				tx,
				release.id,
				"music_track_occurrence",
				first.id,
			);
			assert.ok(current);
			await tx
				.update(musicTrackOccurrence)
				.set({ name: "Human correction" })
				.where(eq(musicTrackOccurrence.id, first.id));
			await assert.rejects(
				mutateMusicComponents(tx, release, actor.id, restored.revision, [
					{
						action: "put",
						component: "music_track_occurrence",
						componentKey: first.id,
						expectedRevisionId: current.id,
						value: { ...current.value, name: "Source overwrote it" },
					},
				]),
				/component revision changed/,
			);
			assert.equal(
				(await readMusicTracks(tx, release, actor.id, medium.id))[0]?.name,
				"Human correction",
			);
			const corrected = await readMusicComponentHead(
				tx,
				release.id,
				"music_track_occurrence",
				first.id,
			);
			const other = await readMusicComponentHead(
				tx,
				release.id,
				"music_track_occurrence",
				second.id,
			);
			const mediumHead = await readMusicComponentHead(tx, release.id, "music_medium", medium.id);
			assert.ok(corrected && other && mediumHead);
			await assert.rejects(
				mutateMusicComponents(tx, release, actor.id, restored.revision, [
					{
						action: "remove",
						component: "music_medium",
						componentKey: medium.id,
						expectedRevisionId: mediumHead.id,
					},
				]),
			);
			assert.equal(
				(await readMusicComponentHead(tx, release.id, "music_medium", medium.id))?.id,
				mediumHead.id,
			);
			const removed = await mutateMusicComponents(tx, release, actor.id, restored.revision, [
				{
					action: "remove",
					component: "music_track_occurrence",
					componentKey: first.id,
					expectedRevisionId: corrected.id,
				},
				{
					action: "remove",
					component: "music_track_occurrence",
					componentKey: second.id,
					expectedRevisionId: other.id,
				},
				{
					action: "remove",
					component: "music_medium",
					componentKey: medium.id,
					expectedRevisionId: mediumHead.id,
				},
			]);
			assert.equal(
				(await tx.select().from(musicMedium).where(eq(musicMedium.releaseId, release.id))).length,
				0,
			);
			await compensateMusicComponents(tx, release, actor.id, removed.revision, removed.changes);
			assert.equal(
				(await readMusicTracks(tx, release, actor.id, medium.id))[0]?.name,
				"Human correction",
			);
			throw rollback;
			});
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		"Verified exact child CAS, track swap/compensation, protected human correction, dependency rejection, atomic rollback and remove/restore; all rows rolled back",
	);
} finally {
	await pool.end();
}
