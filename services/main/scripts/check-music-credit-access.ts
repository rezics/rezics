import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { musicArtistCredit, musicRelease } from "../src/services/database/schema/catalog-music";
import { musicIdentity } from "../src/services/database/schema/catalog-identity";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import {
	currentParticipationAuthority,
	runWithParticipationAuthority,
} from "../src/services/participation/policy";
import { issueParticipationGrant } from "../src/services/participation/commands";
import {
	createMusicRelease,
	createRecording,
	beginMusicCredit,
	appendMusicCreditMembers,
	sealMusicCredit,
	addMusicMedium,
	addMusicTrack,
	readMusicTracks,
} from "../src/services/catalog/domains";
import {
	musicCreditReferenceHeads,
	requireMusicCreditAccess,
} from "../src/services/catalog/music-credit-access";
import { readMusicReleaseMetadata } from "../src/services/catalog/music-domain";
import {
	readMusicComponentHead,
	mutateMusicComponents,
} from "../src/services/catalog/music-structure";
import { loadCatalogIdentity } from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable music credit fixture configuration required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(target.hostname) ||
	target.port !== "25434" ||
	target.pathname !== "/rezics_atlas"
)
	throw new Error("Music credit fixture requires the isolated loopback Atlas target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback music credit authority fixture");
let checks = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Music credit authority fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning({ id: users.id });
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				const authority = currentParticipationAuthority();
				assert.ok(authority);
				const album = await createMusicRelease(tx, account.id, {
					name: { value: "Visible album", languageTag: "en" },
				});
				const recording = await createRecording(tx, account.id, {
					name: { value: "Private recording", languageTag: "en" },
				});
				const otherRecording = await createRecording(tx, account.id, {
					name: { value: "Another private recording", languageTag: "en" },
				});
				const root = { owner: album.owner, id: album.id },
					foreign = { owner: recording.owner, id: recording.id };
				const ownCredit = await beginMusicCredit(tx, account.id, "Visible credit", root);
				await appendMusicCreditMembers(tx, account.id, ownCredit, 0, [
					{ creditedName: "Visible credit", joinPhrase: "" },
				]);
				await sealMusicCredit(tx, account.id, ownCredit, 1);
				const foreignDraft = await beginMusicCredit(tx, account.id, "Private draft", foreign);
				const privateCredit = await beginMusicCredit(tx, account.id, "Private credit", foreign);
				await appendMusicCreditMembers(tx, account.id, privateCredit, 0, [
					{ creditedName: "Private credit", joinPhrase: "" },
				]);
				await sealMusicCredit(tx, account.id, privateCredit, 1);
				await tx
					.update(musicRelease)
					.set({ artistCreditId: ownCredit })
					.where(eq(musicRelease.id, root.id));
				const medium = await addMusicMedium(tx, root, account.id, album.revision, { position: 1 });
				await addMusicTrack(tx, root, account.id, medium.revision, {
					mediumId: medium.id,
					position: 1,
					number: "1",
					name: "Visible presentation",
					artistCreditId: ownCredit,
					recording: foreign,
				});
				const grant = await issueParticipationGrant(tx, authority, {
					recipient: { kind: "auth", authUserId: account.id },
					actingEntityId: authority.actingEntityId,
					capability: "catalog.edit",
					target: root,
				});
				await runWithParticipationAuthority({ ...authority, grant }, async () => {
					await assert.rejects(
						() => beginMusicCredit(tx, account.id, "Unscoped"),
						/authorized music context/,
					);
					checks++;
					await assert.rejects(
						() => beginMusicCredit(tx, account.id, "Foreign", foreign),
						/cannot access/,
					);
					checks++;
					await assert.rejects(
						() =>
							appendMusicCreditMembers(tx, account.id, foreignDraft, 0, [
								{ creditedName: "Wrong edit", joinPhrase: "" },
							]),
						/cannot access/,
					);
					checks++;
					await assert.rejects(
						() => requireMusicCreditAccess(tx, account.id, [privateCredit]),
						/no readable native reference/,
					);
					checks++;
					const scopedCredit = await beginMusicCredit(tx, account.id, "Scoped draft", root);
					await appendMusicCreditMembers(tx, account.id, scopedCredit, 0, [
						{ creditedName: "Scoped draft", joinPhrase: "" },
					]);
					await sealMusicCredit(tx, account.id, scopedCredit, 1);
					assert.equal(
						(
							await requireMusicCreditAccess(tx, account.id, [scopedCredit], {
								reference: root,
								write: true,
							})
						)[0]?.id,
						scopedCredit,
					);
					checks++;
					await assert.rejects(
						() => requireMusicCreditAccess(tx, account.id, [scopedCredit], { reference: root }),
						/no readable native reference/,
					);
					checks++;
					assert.equal(
						(await readMusicReleaseMetadata(tx, root, account.id)).artistCreditId,
						ownCredit,
					);
					checks++;
					const tracks = await readMusicTracks(tx, root, account.id, medium.id);
					assert.equal(tracks[0]?.recordingId, null);
					checks++;
					assert.equal(tracks[0]?.artistCreditId, ownCredit);
					checks++;
					const track = tracks[0];
					assert.ok(track);
					const head = await readMusicComponentHead(
						tx,
						root.id,
						"music_track_occurrence",
						track.id,
					);
					assert.ok(head);
					const current = await loadCatalogIdentity(tx, root, account.id, true);
					const changed = await mutateMusicComponents(tx, root, account.id, current.revision, [
						{
							action: "put",
							component: "music_track_occurrence",
							componentKey: track.id,
							expectedRevisionId: head.id,
							value: { ...head.value, name: "Updated presentation" },
						},
					]);
					const changedHead = await readMusicComponentHead(
						tx,
						root.id,
						"music_track_occurrence",
						track.id,
					);
					assert.equal(changedHead?.value.recording_id, foreign.id);
					checks++;
					assert.equal(changedHead?.value.name, "Updated presentation");
					checks++;
					assert.ok(changedHead);
					await assert.rejects(
						() =>
							mutateMusicComponents(tx, root, account.id, changed.revision, [
								{
									action: "put",
									component: "music_track_occurrence",
								componentKey: track.id,
									expectedRevisionId: changedHead.id,
									value: { ...changedHead.value, recording_id: otherRecording.id },
								},
							]),
						/cannot access/,
					);
					checks++;
				});
				await assert.rejects(
					tx.transaction((inner) =>
						inner
							.update(musicArtistCredit)
							.set({ createdForMusicId: foreign.id })
							.where(eq(musicArtistCredit.id, ownCredit)),
					),
				);
				checks++;
				await assert.rejects(
					tx.transaction(async (inner) => {
						await inner
							.update(musicIdentity)
							.set({ deletedAt: new Date() })
							.where(eq(musicIdentity.id, root.id));
						await inner.insert(musicArtistCredit).values({
							renderedName: "Invalid retired context",
							createdByAuthUserId: account.id,
							createdForMusicId: root.id,
						});
					}),
				);
				checks++;
				const refs = await musicCreditReferenceHeads(tx, root.id, "music_release", [root.id]);
				assert.equal(
					(
						await requireMusicCreditAccess(tx, null, [ownCredit], {
							reference: root,
							historyIds: refs,
						}).catch(() => [])
					).length,
					0,
				);
				checks++;
				await tx
					.update(musicIdentity)
					.set({ status: "published", visibility: "public" })
					.where(eq(musicIdentity.id, root.id));
				assert.equal((await readMusicReleaseMetadata(tx, root, null)).artistCreditId, ownCredit);
				checks++;
				const [unchanged] = await tx
					.select({ count: musicArtistCredit.memberCount })
					.from(musicArtistCredit)
					.where(
						and(
							eq(musicArtistCredit.id, foreignDraft),
							eq(musicArtistCredit.createdForMusicId, foreign.id),
						),
					)
					.limit(1);
				assert.equal(unchanged?.count, 0);
				checks++;
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified ${checks} credit creation-context, private-fragment, scoped read and current-reference SQL checks; fixture rolled back`,
	);
} finally {
	await pool.end();
}
