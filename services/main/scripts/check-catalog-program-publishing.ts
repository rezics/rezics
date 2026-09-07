import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { users } from "../src/services/database/schema/auth";
import {
	createProgramStructure,
	listProgramOccurrences,
	putProgramOccurrence,
	readProgramStructure,
	removeProgramOccurrence,
	updateProgramStructure,
} from "../src/services/catalog/program";
import {
	createSerialization,
	listPublishingInstallments,
	putPublishingCoverage,
	putPublishingInstallment,
	readPublishingStructure,
} from "../src/services/catalog/publishing";
import {
	createPublication,
	createPublishingWork,
	createTextVersion,
} from "../src/services/catalog/domains";
import { ensureCatalogDefinition } from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)
)
	throw new Error("Program acceptance requires an isolated Atlas fixture database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 10_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback program and publishing fixture");
const name = (value: string) => ({ value, languageTag: "en" });
let checks = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({ name: "Program fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			const program = await createProgramStructure(
				tx,
				actor,
				{
					shape: "program",
					fields: { declaredMainEpisodeCount: 26, declaredTotalEpisodeCount: 31 },
				},
				name("Program"),
			);
			const season = await createProgramStructure(
				tx,
				actor,
				{ shape: "season", fields: { programId: program.id, number: "I" } },
				name("Season"),
			);
			const version = await createProgramStructure(
				tx,
				actor,
				{ shape: "program_version", fields: { programId: program.id } },
				name("Version"),
			);
			const episode = await createProgramStructure(
				tx,
				actor,
				{
					shape: "episode",
					fields: {
						programId: program.id,
						seasonId: season.id,
						sortNumber: 1.5,
						episodeNumber: 2,
						durationText: "00:24:43",
						lengthMilliseconds: 1_483_000,
						date: { year: 1998, month: 10, day: null },
					},
				},
				name("Episode"),
			);
			const exported = await readProgramStructure(tx, episode, actor);
			assert.ok("sortNumber" in exported.record);
			assert.equal(exported.record.sortNumber, "1.5");
			assert.ok("dateDay" in exported.record);
			assert.equal(exported.record.dateDay, null);
			checks += 2;
			const first = await putProgramOccurrence(tx, version, actor, version.revision, {
				episodeId: episode.id,
				position: "a0",
			});
			const second = await putProgramOccurrence(tx, version, actor, first.revision, {
				episodeId: episode.id,
				position: "a1",
				sourceNumber: "encore",
			});
			const page1 = await listProgramOccurrences(tx, version, actor, { limit: 1 });
			assert.equal(page1.items[0]?.id, first.id);
			assert.ok(page1.nextCursor);
			const page2 = await listProgramOccurrences(tx, version, actor, {
				limit: 1,
				after: page1.nextCursor,
			});
			assert.equal(page2.items[0]?.id, second.id);
			checks += 2;
			await assert.rejects(
				tx.transaction((nested) =>
					updateProgramStructure(nested, program, actor, program.revision - 1, {
						shape: "program",
						fields: {},
					}),
				),
			);
			await assert.rejects(readProgramStructure(tx, episode, null));
			checks += 2;
			await removeProgramOccurrence(tx, version, actor, second.revision, first.id);
			assert.equal((await listProgramOccurrences(tx, version, actor)).items.length, 1);
			checks++;
			const work = await createPublishingWork(tx, actor, name("Work"));
			const text = await createTextVersion(tx, actor, { name: name("Text"), languageTag: "en" });
			const publication = await createPublication(tx, actor, {
				name: name("Publication"),
				pageCount: 320,
			});
			await putPublishingCoverage(tx, text, actor, text.revision, {
				kind: "text_work",
				targetId: work.id,
				position: 0,
			});
			await putPublishingCoverage(tx, publication, actor, publication.revision, {
				kind: "publication_text",
				targetId: text.id,
				position: 0,
			});
			const serialization = await createSerialization(tx, actor, {
				name: name("Serial"),
				textVersionId: text.id,
			});
			const kind = await ensureCatalogDefinition(tx, {
				namespace: "catalog",
				key: "chapter",
				kind: "class",
				valueKind: null,
			});
			const chapter = await putPublishingInstallment(
				tx,
				serialization,
				actor,
				serialization.revision,
				{ position: "a0", label: "I", kindRevisionId: kind.revisionId },
			);
			const part = await putPublishingInstallment(tx, serialization, actor, chapter.revision, {
				parentId: chapter.id,
				position: "a0",
				label: "Opening",
				kindRevisionId: kind.revisionId,
			});
			await assert.rejects(
				tx.transaction((nested) =>
					putPublishingInstallment(nested, serialization, actor, part.revision, {
						id: chapter.id,
						parentId: part.id,
						position: "a0",
						kindRevisionId: kind.revisionId,
					}),
				),
			);
			assert.equal(
				(await listPublishingInstallments(tx, serialization, actor, { parentId: chapter.id }))[0]
					?.label,
				"Opening",
			);
			assert.equal(
				(await readPublishingStructure(tx, publication, actor)).identity.shape,
				"publication",
			);
			checks += 3;
			const plans = await tx.execute(
				sql`explain (format json) select id from program_episode_occurrence where owner_id = ${version.id}::uuid and (position, id) > ('a0', ${first.id}::uuid) order by position, id limit 100`,
			);
			assert.ok(plans.rows.length);
			console.log(JSON.stringify({ kind: "program-occurrence-explain", plans: plans.rows }));
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		`Program and publishing acceptance passed: ${checks} checks; all fixture writes rolled back.`,
	);
} finally {
	await pool.end();
}
