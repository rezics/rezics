import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { musicIdentity } from "../src/services/database/schema/catalog-identity";
import {
	publishingPublication,
	publishingReleaseEvent,
	publishingSerialization,
	publishingInstallment,
	publishingWork,
} from "../src/services/database/schema/catalog-publishing";
import {
	musicArtistCredit,
	musicArtistCreditName,
	musicRecording,
	musicReleaseEvent,
	musicTrackOccurrence,
} from "../src/services/database/schema/catalog-music";
import { programEpisode, programWork } from "../src/services/database/schema/catalog-program";
import { publishingIdentifierClaim } from "../src/services/database/schema/catalog-facts";
import {
	addCatalogName,
	createCatalogIdentity,
	ensureCatalogDefinition,
} from "../src/services/catalog/storage";
import {
	beginMusicCredit,
	appendMusicCreditMembers,
	sealMusicCredit,
	addMusicMedium,
	addMusicTrack,
	addReleaseDate,
	addSoftwareEdition,
	createArea,
	createEpisode,
	createMusicCredit,
	createMusicRelease,
	createMusicalWork,
	createProgram,
	createPublication,
	createRecording,
	createReleaseGroup,
	createSoftwareRelease,
	createVisualNovel,
	readMusicTracks,
} from "../src/services/catalog/domains";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== "/rezics" ||
	url.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")
)
	throw new Error("Domain acceptance requires rezics-dev PostgreSQL");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 10_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback domain acceptance fixture");
let checks = 0;
const named = (value: string) => ({ languageTag: "en", value });
async function rejectsCode(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
	code: string,
) {
	await assert.rejects(tx.transaction(work), (error: unknown) => {
		let current = error;
		for (let depth = 0; depth < 5 && current; depth++) {
			const parsed = z.object({ code: z.string() }).safeParse(current);
			if (parsed.success) return parsed.data.code === code;
			current = current instanceof Error ? current.cause : undefined;
		}
		return false;
	});
	checks++;
}

try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({ name: "Domain schema fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			const publication = await createPublication(tx, actor, {
				name: named("Standalone publication"),
				pageCount: 320,
				paginationText: "xii + 320",
			});
			assert.equal(
				(await tx.select().from(publishingWork).where(eq(publishingWork.id, publication.id)))
					.length,
				0,
			);
			assert.equal(
				(
					await tx
						.select()
						.from(publishingPublication)
						.where(eq(publishingPublication.id, publication.id))
				)[0]?.paginationText,
				"xii + 320",
			);
			const secondPublication = await createPublication(tx, actor, {
				name: named("Another publication"),
			});
			await tx.insert(publishingIdentifierClaim).values([
				{
					ownerId: publication.id,
					namespace: "isbn13",
					value: "9780306406157",
					normalizedValue: "9780306406157",
				},
				{
					ownerId: publication.id,
					namespace: "isbn13",
					value: "9781861972712",
					normalizedValue: "9781861972712",
				},
				{
					ownerId: secondPublication.id,
					namespace: "isbn13",
					value: "9780306406157",
					normalizedValue: "9780306406157",
				},
			]);
			assert.equal(
				(
					await tx
						.select()
						.from(publishingIdentifierClaim)
						.where(eq(publishingIdentifierClaim.ownerId, publication.id))
				).length,
				2,
			);
			checks += 3;
			publication.revision = (
				await addReleaseDate(tx, publication, actor, publication.revision, {
					date: { year: 2020, month: null, day: null },
					dateText: "2020",
				})
			).revision;
			const [published] = await tx
				.select()
				.from(publishingReleaseEvent)
				.where(eq(publishingReleaseEvent.publicationId, publication.id));
			assert.equal(published?.dateMonth, null);
			assert.equal(published?.dateDay, null);
			checks += 2;
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(publishingReleaseEvent)
						.values({ publicationId: publication.id, dateYear: 1900, dateMonth: 2, dateDay: 29 }),
				"23514",
			);

			const firstArtist = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person" },
				actor,
			);
			const secondArtist = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person" },
				actor,
			);
			const credit = await createMusicCredit(tx, actor, [
				{ artist: firstArtist, creditedName: "Original A", joinPhrase: " feat. " },
				{ artist: secondArtist, creditedName: "Original B", joinPhrase: "" },
			]);
			await addCatalogName(tx, firstArtist, actor, firstArtist.revision, {
				languageTag: "en",
				kind: "alias",
				value: "Current artist name",
			});
			assert.deepEqual(
				(
					await tx
						.select()
						.from(musicArtistCreditName)
						.where(eq(musicArtistCreditName.creditId, credit))
						.orderBy(musicArtistCreditName.position)
				).map(({ creditedName, joinPhrase }) => [creditedName, joinPhrase]),
				[
					["Original A", " feat. "],
					["Original B", ""],
				],
			);
			checks++;
			const work = await createMusicalWork(tx, actor, named("Composition"));
			await rejectsCode(
				tx,
				(nested) => nested.insert(musicRecording).values({ id: work.id }),
				"23503",
			);
			const largeCredit = await beginMusicCredit(tx, actor);
			const largeMembers = Array.from({ length: 520 }, (_, position) => ({
				creditedName: `Original credit ${position}`,
				joinPhrase: position === 519 ? "" : ", ",
				sourcePosition: position * 2,
			}));
			for (let offset = 0; offset < largeMembers.length; offset += 128)
				await appendMusicCreditMembers(
					tx,
					actor,
					largeCredit,
					offset,
					largeMembers.slice(offset, offset + 128),
				);
			await sealMusicCredit(tx, actor, largeCredit, 520);
			assert.equal(
				(await tx.select().from(musicArtistCredit).where(eq(musicArtistCredit.id, largeCredit)))[0]
					?.memberCount,
				520,
			);
			assert.equal(
				(
					await tx
						.select()
						.from(musicArtistCreditName)
						.where(
							and(
								eq(musicArtistCreditName.creditId, largeCredit),
								eq(musicArtistCreditName.position, 519),
							),
						)
				)[0]?.sourcePosition,
				1038,
			);
			checks += 2;
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(musicArtistCreditName)
						.set({ creditedName: "tampered" })
						.where(
							and(
								eq(musicArtistCreditName.creditId, largeCredit),
								eq(musicArtistCreditName.position, 0),
							),
						),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(musicArtistCredit)
						.set({ memberCount: 1 })
						.where(eq(musicArtistCredit.id, largeCredit)),
				"23514",
			);
			const draftCredit = await beginMusicCredit(tx, actor);
			const draftRecording = await createCatalogIdentity(
				tx,
				{ owner: "music", shape: "recording" },
				actor,
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(musicRecording)
						.values({ id: draftRecording.id, artistCreditId: draftCredit }),
				"23514",
			);
			const recording = await createRecording(tx, actor, {
				name: named("Shared recording"),
				artistCreditId: credit,
				lengthMilliseconds: 123_456,
				video: false,
			});
			const group = await createReleaseGroup(tx, actor, named("Release group"));
			const firstRelease = await createMusicRelease(tx, actor, {
				name: named("First release"),
				releaseGroup: group,
				artistCreditId: credit,
			});
			const secondRelease = await createMusicRelease(tx, actor, {
				name: named("Second release"),
				releaseGroup: group,
			});
			const firstMedium = await addMusicMedium(tx, firstRelease, actor, firstRelease.revision, {
				position: 1,
				name: "Disc 1",
			});
			firstRelease.revision = firstMedium.revision;
			const secondMedium = await addMusicMedium(tx, secondRelease, actor, secondRelease.revision, {
				position: 1,
				name: "Side A",
			});
			secondRelease.revision = secondMedium.revision;
			const firstTrack = await addMusicTrack(tx, firstRelease, actor, firstRelease.revision, {
				mediumId: firstMedium.id,
				recording,
				position: 0,
				number: "A1",
				name: "Printed title A",
				artistCreditId: credit,
				lengthMilliseconds: 123_000,
			});
			firstRelease.revision = firstTrack.revision;
			const secondTrack = await addMusicTrack(tx, secondRelease, actor, secondRelease.revision, {
				mediumId: secondMedium.id,
				recording,
				position: 3,
				number: "03",
				name: "Printed title B",
				lengthMilliseconds: 124_000,
			});
			secondRelease.revision = secondTrack.revision;
			const [left] = await readMusicTracks(tx, firstRelease, actor, firstMedium.id);
			const [right] = await readMusicTracks(tx, secondRelease, actor, secondMedium.id);
			assert.equal(left?.recordingId, recording.id);
			assert.equal(right?.recordingId, recording.id);
			assert.notEqual(left?.id, right?.id);
			assert.equal(left?.number, "A1");
			assert.equal(right?.number, "03");
			assert.equal(left?.name, "Printed title A");
			assert.equal(right?.lengthMilliseconds, 124_000);
			assert.equal(
				(await tx.select().from(musicIdentity).where(eq(musicIdentity.id, firstTrack.id))).length,
				0,
			);
			checks += 8;
			await rejectsCode(
				tx,
				(nested) =>
					nested.insert(musicTrackOccurrence).values({
						releaseId: firstRelease.id,
						mediumId: secondMedium.id,
						position: 1,
						number: "1",
						recordingId: recording.id,
					}),
				"23503",
			);
			const area = await createArea(tx, actor, named("Release territory"));
			firstRelease.revision = (
				await addReleaseDate(tx, firstRelease, actor, firstRelease.revision, {
					area,
					date: { year: 2024, month: 2, day: 29 },
				})
			).revision;
			firstRelease.revision = (
				await addReleaseDate(tx, firstRelease, actor, firstRelease.revision, {
					date: { year: 2025, month: 3, day: null },
				})
			).revision;
			assert.equal(
				(
					await tx
						.select()
						.from(musicReleaseEvent)
						.where(eq(musicReleaseEvent.releaseId, firstRelease.id))
				).length,
				2,
			);
			checks++;

			const program = await createProgram(tx, actor, {
				name: named("Program fixture"),
				mainEpisodes: 26,
				totalEpisodes: 31,
			});
			const episode = await createEpisode(tx, actor, {
				name: named("Special episode"),
				program,
				sort: 1.5,
				episodeNumber: 2,
				durationText: "24m",
			});
			const [programRow] = await tx
				.select()
				.from(programWork)
				.where(eq(programWork.id, program.id));
			const [episodeRow] = await tx
				.select()
				.from(programEpisode)
				.where(eq(programEpisode.id, episode.id));
			assert.equal(programRow?.declaredMainEpisodeCount, 26);
			assert.equal(programRow?.declaredTotalEpisodeCount, 31);
			assert.equal(episodeRow?.sortNumber, "1.5");
			assert.equal(episodeRow?.episodeNumber, "2");
			assert.equal(episodeRow?.durationText, "24m");
			checks += 5;

			const vn = await createVisualNovel(tx, actor, named("VN one"));
			const otherVn = await createVisualNovel(tx, actor, named("VN two"));
			const edition = await addSoftwareEdition(tx, vn, actor, vn.revision, {
				sourceNamespace: "vndb",
				sourceLocalId: "1",
				name: "Original",
			});
			await addSoftwareEdition(tx, otherVn, actor, otherVn.revision, {
				sourceNamespace: "vndb",
				sourceLocalId: "1",
				name: "Different VN edition",
			});
			await createSoftwareRelease(tx, actor, {
				name: named("VN release"),
				content: vn,
				editionId: edition.id,
				isPatch: false,
			});
			await rejectsCode(
				tx,
				(nested) =>
					createSoftwareRelease(nested, actor, {
						name: named("Wrong VN edition"),
						content: otherVn,
						editionId: edition.id,
					}),
				"23503",
			);

			const installmentKind = await ensureCatalogDefinition(tx, {
				namespace: "domain-fixture",
				key: "chapter",
				kind: "vocabulary",
				valueKind: null,
			});
			const serialization = await createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "serialization" },
				actor,
			);
			await tx.insert(publishingSerialization).values({ id: serialization.id });
			const [volume] = await tx
				.insert(publishingInstallment)
				.values({
					serializationId: serialization.id,
					position: "a0",
					kindRevisionId: installmentKind.revisionId,
					label: "Volume 1",
				})
				.returning();
			assert.ok(volume);
			const [chapter] = await tx
				.insert(publishingInstallment)
				.values({
					serializationId: serialization.id,
					parentId: volume.id,
					position: "a0",
					kindRevisionId: installmentKind.revisionId,
					label: "Chapter 1",
				})
				.returning();
			assert.ok(chapter);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(publishingInstallment)
						.set({ parentId: chapter.id })
						.where(
							and(
								eq(publishingInstallment.serializationId, serialization.id),
								eq(publishingInstallment.id, volume.id),
							),
						),
				"23514",
			);
			const wrongKind = await ensureCatalogDefinition(tx, {
				namespace: "domain-fixture",
				key: "not-a-format",
				kind: "role",
				valueKind: null,
			});
			await rejectsCode(
				tx,
				(nested) =>
					nested.execute(
						sql`update public.music_release set packaging_revision_id = ${wrongKind.revisionId}::uuid where id = ${firstRelease.id}::uuid`,
					),
				"23514",
			);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(`Passed ${checks} domain schema assertions; all fixture data rolled back`);
} finally {
	await pool.end();
}
