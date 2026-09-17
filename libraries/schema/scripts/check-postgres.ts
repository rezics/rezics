import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { BundleSchema, type RelationRevision } from "../src/contracts";
import * as tables from "../src/drizzle";
import { compileVocabularies } from "../src/importer";
import { initialProfiles } from "../src/profiles";
import { VocabularyRegistry } from "../src/registry";
import { digest, termId } from "../src/identity";
import {
	createSchemaDatabase,
	exportVocabularyBundle,
	importVocabularyBundle,
	installProfile,
	putChange,
	putRelationRevision,
	readTermLabels,
	relationIntegritySql,
	selectRelationRevision,
	selectTermLabel,
	selectVocabularyRelease,
	type ReferenceValidator,
} from "../src/postgres";

const run = promisify(execFile),
	root = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = resolve(root, "../../.temp");
await mkdir(temporaryRoot, { recursive: true });
const scratch = await mkdtemp(resolve(temporaryRoot, "schema-postgres-"));
const data = resolve(scratch, "data"),
	log = resolve(scratch, "postgres.log");
const pools: Pool[] = [];
let started = false;
const passed: string[] = [];
const step = async (name: string, action: () => Promise<void>) => {
	await action();
	passed.push(name);
	console.info(`PASS ${name}`);
};
const hasCode = (error: unknown, code: string): boolean => {
	if (!(error instanceof Error)) return false;
	return ("code" in error && error.code === code) || hasCode(error.cause, code);
};
const rejectCode = (action: () => Promise<unknown>, code: string) =>
	assert.rejects(action, (error) => hasCode(error, code));

try {
	await run(
		"initdb",
		[
			"-D",
			data,
			"--username=schema_fixture",
			"--auth-local=trust",
			"--auth-host=trust",
			"--no-locale",
			"--encoding=UTF8",
		],
		{ timeout: 30_000 },
	);
	const socket = createServer();
	await new Promise<void>((resolve, reject) => {
		socket.once("error", reject);
		socket.listen(0, "127.0.0.1", resolve);
	});
	const address = socket.address();
	if (!address || typeof address === "string") throw new Error("No ephemeral port");
	const port = address.port;
	await new Promise<void>((resolve, reject) =>
		socket.close((error) => (error ? reject(error) : resolve())),
	);
	await run(
		"pg_ctl",
		[
			"-D",
			data,
			"-l",
			log,
			"-o",
			`-h 127.0.0.1 -p ${port} -k ${scratch} -c fsync=on`,
			"-w",
			"start",
		],
		{ timeout: 30_000 },
	);
	started = true;
	const connection = (database: string) =>
		new Pool({ host: "127.0.0.1", port, user: "schema_fixture", database, max: 6 });
	const admin = connection("postgres");
	pools.push(admin);
	await admin.query("CREATE DATABASE schema_fixture");
	await admin.query("CREATE DATABASE schema_migrated");
	const pool = connection("schema_fixture"),
		secondPool = connection("schema_migrated");
	pools.push(pool, secondPool);
	const db = createSchemaDatabase(pool),
		second = createSchemaDatabase(secondPool);
	const version = (await pool.query("SHOW server_version")).rows[0]?.server_version;
	await step("generated migrations install and replay idempotently", async () => {
		await migrate(db, { migrationsFolder: resolve(root, "migrations") });
		await migrate(db, { migrationsFolder: resolve(root, "migrations") });
		await migrate(second, { migrationsFolder: resolve(root, "migrations") });
		assert.equal(
			(
				await pool.query(
					"SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'schema_%'",
				)
			).rows[0]?.count,
			18,
		);
	});
	await step("Drizzle declarations match the committed migration snapshot", async () => {
		const output = resolve(scratch, "drift");
		await cp(resolve(root, "migrations"), output, { recursive: true });
		const before = await readdir(output),
			config = resolve(scratch, "drift.config.ts");
		await writeFile(
			config,
			`export default ${JSON.stringify({ dialect: "postgresql", schema: resolve(root, "src/drizzle.ts"), out: output })};\n`,
		);
		await run("yarn", ["exec", "drizzle-kit", "generate", "--config", config], {
			cwd: root,
			timeout: 30_000,
		});
		assert.deepEqual(await readdir(output), before, "Drizzle schema has ungenerated changes");
	});
	const bundle = BundleSchema.parse(
		JSON.parse(await readFile(resolve(root, "registry/bundle.json"), "utf8")),
	);
	const registry = new VocabularyRegistry(bundle),
		read = (file: string) => readFile(resolve(root, "registry/sources", file));
	await step("all official vocabularies import without implicit adoption", async () => {
		await importVocabularyBundle(db, bundle, read);
		assert.equal((await db.select().from(tables.schemaVocabularyHead)).length, 0);
		assert.equal((await db.select().from(tables.schemaTerm)).length, bundle.terms.length);
		assert.equal((await db.select().from(tables.schemaRelease)).length, 11);
	});
	await step("repeating a full import preserves identities and row counts", async () => {
		const counts = await pool.query(
			"SELECT (SELECT count(*) FROM schema_definition) AS meanings, (SELECT count(*) FROM schema_label) AS labels",
		);
		await importVocabularyBundle(db, bundle, read);
		assert.deepEqual(
			(
				await pool.query(
					"SELECT (SELECT count(*) FROM schema_definition) AS meanings, (SELECT count(*) FROM schema_label) AS labels",
				)
			).rows,
			counts.rows,
		);
	});
	await step("selection CAS and all six description profiles persist", async () => {
		await db.transaction(async (tx) => {
			for (const release of bundle.releases) await selectVocabularyRelease(tx, release.id, 0);
			for (const profile of initialProfiles(registry)) await installProfile(tx, profile);
		});
		await assert.rejects(
			db.transaction((tx) => selectVocabularyRelease(tx, bundle.releases[0]!.id, 0)),
			/selection changed/u,
		);
		assert.equal((await db.select().from(tables.schemaProfileRevision)).length, 6);
	});
	const book = randomUUID(),
		person = randomUUID(),
		otherPerson = randomUUID(),
		bookRevision = randomUUID();
	await pool.query(
		"CREATE TABLE fixture_book (id uuid PRIMARY KEY, revision_id uuid NOT NULL); CREATE TABLE fixture_person (id uuid PRIMARY KEY)",
	);
	await pool.query("INSERT INTO fixture_book VALUES ($1,$2)", [book, bookRevision]);
	await pool.query("INSERT INTO fixture_person VALUES ($1),($2)", [person, otherPerson]);
	const validateReference: ReferenceValidator = async (reference, tx) => {
		let exists = false;
		if (reference.owner === "publishing") {
			const rows = await tx.execute(
				sql`select 1 from fixture_book where id=${reference.id}::uuid and (${reference.revisionId ?? null}::uuid is null or revision_id=${reference.revisionId ?? null}::uuid)`,
			);
			exists = rows.rows.length > 0;
		} else if (reference.owner === "entity" && !reference.revisionId) {
			exists =
				(await tx.execute(sql`select 1 from fixture_person where id=${reference.id}::uuid`)).rows
					.length > 0;
		} else if (reference.owner === "relation" && reference.revisionId) {
			exists =
				(
					await tx
						.select()
						.from(tables.schemaRelationRevision)
						.where(
							and(
								eq(tables.schemaRelationRevision.id, reference.revisionId),
								eq(tables.schemaRelationRevision.relationId, reference.id),
							),
						)
				).length > 0;
		}
		if (!exists) throw new TypeError("Logical reference or exact revision is missing");
	};
	const change = randomUUID(),
		predicate = registry.term("https://schema.org/author").id,
		definition = registry.definition(predicate, "schemaorg").id;
	const first: RelationRevision = {
		id: randomUUID(),
		relationId: randomUUID(),
		subject: { owner: "publishing", id: book },
		predicateId: predicate,
		definitionId: definition,
		parentRevisionId: null,
		changeId: change,
		value: { kind: "reference", reference: { owner: "entity", id: person } },
		position: null,
	};
	const revised: RelationRevision = {
		...first,
		id: randomUUID(),
		parentRevisionId: first.id,
		value: { kind: "reference", reference: { owner: "entity", id: otherPerson } },
	};
	const selection = {
		id: randomUUID(),
		relationId: first.relationId,
		revisionId: first.id,
		expectedVersion: 0,
		changeId: change,
	};
	await step(
		"independent relation IDs retain duplicate endpoints and separate proposal/adoption",
		async () => {
			await db.transaction(async (tx) => {
				await putChange(tx, {
					id: change,
					actor: null,
					message: "Book author and supporting evidence",
				});
				await putRelationRevision(tx, first, validateReference);
				await putRelationRevision(tx, first, validateReference);
				await putRelationRevision(
					tx,
					{ ...first, id: randomUUID(), relationId: randomUUID() },
					validateReference,
				);
				await selectRelationRevision(tx, selection);
				await putRelationRevision(tx, revised, validateReference);
			});
			assert.equal((await db.select().from(tables.schemaRelation)).length, 2);
			assert.equal((await db.select().from(tables.schemaRelationRevision)).length, 3);
			assert.equal(
				(await db.select().from(tables.schemaRelationSelection))[0]?.revisionId,
				first.id,
			);
		},
	);
	await step(
		"review and source links remain attached to the old exact relation revision",
		async () => {
			const citation = registry.term("https://schema.org/citation").id;
			await db.transaction((tx) =>
				putRelationRevision(
					tx,
					{
						...first,
						id: randomUUID(),
						relationId: randomUUID(),
						subject: { owner: "relation", id: first.relationId, revisionId: first.id },
						predicateId: citation,
						definitionId: registry.definition(citation, "schemaorg").id,
						value: { kind: "iri", iri: "https://example.test/source/edition-1" },
					},
					validateReference,
				),
			);
			const evidence = await db
				.select()
				.from(tables.schemaRelationRevision)
				.where(eq(tables.schemaRelationRevision.subjectRevisionId, first.id));
			assert.equal(evidence.length, 1);
			assert.equal(evidence[0]?.subjectRevisionId, first.id);
		},
	);
	await step(
		"ordering is numeric and preserves integers beyond JavaScript's safe range",
		async () => {
			const ids: string[] = [];
			await db.transaction(async (tx) => {
				for (const position of ["10", "900719925474099312345", "2"]) {
					const id = randomUUID();
					ids.push(id);
					await putRelationRevision(
						tx,
						{ ...first, id, relationId: randomUUID(), position },
						validateReference,
					);
				}
			});
			const rows = await db
				.select()
				.from(tables.schemaRelationRevision)
				.where(inArray(tables.schemaRelationRevision.id, ids))
				.orderBy(tables.schemaRelationRevision.position);
			assert.deepEqual(
				rows.map((row) => row.position),
				["2", "10", "900719925474099312345"],
			);
			await rejectCode(
				() =>
					db
						.insert(tables.schemaRelationRevision)
						.values({ ...rows[0]!, id: randomUUID(), position: "1.5" }),
				"23514",
			);
		},
	);
	await step(
		"translations exceed 32 languages without touching semantic revisions or assertions",
		async () => {
			const before = await db.select().from(tables.schemaRelationRevision),
				meanings = (await db.select().from(tables.schemaDefinition)).length;
			const languages = [
				"zh-Hant",
				"en",
				"fr",
				"de",
				"es",
				"pt",
				"it",
				"nl",
				"sv",
				"da",
				"no",
				"fi",
				"pl",
				"cs",
				"sk",
				"sl",
				"hr",
				"sr",
				"bg",
				"ro",
				"hu",
				"el",
				"ru",
				"uk",
				"tr",
				"ar",
				"he",
				"fa",
				"hi",
				"bn",
				"ta",
				"te",
				"ko",
				"ja",
				"vi",
				"th",
				"id",
				"ms",
				"sw",
				"af",
			];
			await db.transaction(async (tx) => {
				for (const language of languages)
					await selectTermLabel(tx, {
						id: randomUUID(),
						label: {
							termId: predicate,
							predicate: "http://www.w3.org/2000/01/rdf-schema#label",
							value: language === "zh-Hant" ? "作者" : `Author (${language})`,
							language,
							datatype: "http://www.w3.org/2001/XMLSchema#string",
						},
						expectedVersion: 0,
						changeId: change,
					});
			});
			assert.equal((await db.select().from(tables.schemaLabelSelection)).length, 40);
			assert.deepEqual(await db.select().from(tables.schemaRelationRevision), before);
			assert.equal((await db.select().from(tables.schemaDefinition)).length, meanings);
			assert.equal((await readTermLabels(db, [predicate], "zh-Hant"))[0]?.label?.value, "作者");
		},
	);
	await step("concurrent adoption admits one writer and rejects stale selection", async () => {
		const next = { ...selection, revisionId: revised.id, expectedVersion: 1 };
		const results = await Promise.allSettled([
			db.transaction((tx) => selectRelationRevision(tx, { ...next, id: randomUUID() })),
			db.transaction((tx) => selectRelationRevision(tx, { ...next, id: randomUUID() })),
		]);
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
		const rejected = results.find((result) => result.status === "rejected");
		assert.ok(
			rejected?.status === "rejected" && /selection changed/u.test(String(rejected.reason)),
		);
		assert.equal(
			await db.transaction((tx) => selectRelationRevision(tx, selection)),
			1,
			"exact retry returns its prior receipt",
		);
		await assert.rejects(
			db.transaction((tx) => selectRelationRevision(tx, { ...selection, revisionId: revised.id })),
			/reused/u,
		);
	});
	await step(
		"storage rejects mismatched definitions, cross-relation revisions and mutable history",
		async () => {
			await rejectCode(
				() =>
					db.transaction((tx) =>
						putRelationRevision(
							tx,
							{
								...first,
								id: randomUUID(),
								predicateId: registry.term("https://schema.org/creator").id,
							},
							validateReference,
						),
					),
				"23503",
			);
			const other = (await db.select().from(tables.schemaRelationRevision)).find(
				(row) => row.relationId !== first.relationId,
			)!;
			await rejectCode(
				() =>
					db.transaction((tx) =>
						selectRelationRevision(tx, {
							...selection,
							id: randomUUID(),
							expectedVersion: 2,
							revisionId: other.id,
						}),
					),
				"23503",
			);
			await rejectCode(
				() =>
					db
						.update(tables.schemaRelationRevision)
						.set({ position: "1" })
						.where(eq(tables.schemaRelationRevision.id, first.id)),
				"23514",
			);
			await rejectCode(
				() => db.delete(tables.schemaDefinition).where(eq(tables.schemaDefinition.id, definition)),
				"23514",
			);
			await assert.rejects(
				db.transaction((tx) =>
					putRelationRevision(
						tx,
						{
							...first,
							id: randomUUID(),
							value: { kind: "reference", reference: { owner: "entity", id: randomUUID() } },
						},
						validateReference,
					),
				),
				/reference/u,
			);
			await assert.rejects(
				db.transaction((tx) =>
					putRelationRevision(tx, { ...first, position: "99" }, validateReference),
				),
				/reused/u,
			);
		},
	);
	await step("rejected compound writes roll back edit and assertion together", async () => {
		const edit = randomUUID();
		await rejectCode(
			() =>
				db.transaction(async (tx) => {
					await putChange(tx, { id: edit, actor: null, message: "Must roll back" });
					await putRelationRevision(
						tx,
						{
							...first,
							id: randomUUID(),
							relationId: randomUUID(),
							changeId: edit,
							definitionId: randomUUID(),
						},
						validateReference,
					);
				}),
			"23503",
		);
		assert.equal(
			(await db.select().from(tables.schemaChange).where(eq(tables.schemaChange.id, edit))).length,
			0,
		);
	});
	await step(
		"database guards reject cyclic history, malformed references and corrupt artifact bytes",
		async () => {
			const [template] = await db
				.select()
				.from(tables.schemaRelationRevision)
				.where(eq(tables.schemaRelationRevision.id, first.id));
			assert.ok(template);
			const a = randomUUID(),
				b = randomUUID();
			await rejectCode(
				() =>
					db.insert(tables.schemaRelationRevision).values([
						{ ...template, id: a, parentRevisionId: b },
						{ ...template, id: b, parentRevisionId: a },
					]),
				"23514",
			);
			await rejectCode(
				() =>
					db.execute(sql`insert into schema_relation_revision (id,relation_id,predicate_id,definition_id,change_id,value,digest)
			select ${randomUUID()}::uuid,relation_id,predicate_id,definition_id,change_id,'{"kind":"reference","reference":{"owner":"entity"}}'::jsonb,digest
			from schema_relation_revision where id=${first.id}::uuid`),
				"23514",
			);
			const [release] = await db.select().from(tables.schemaRelease);
			assert.ok(release);
			await rejectCode(
				() =>
					db.insert(tables.schemaRelease).values({
						...release,
						id: randomUUID(),
						digest: "f".repeat(64),
						sourceBytes: Buffer.from("corrupt"),
					}),
				"23514",
			);
		},
	);
	await step(
		"complete PostgreSQL export rebuilds on another database with the same IDs",
		async () => {
			const exported = await exportVocabularyBundle(db);
			assert.deepEqual(exported.bundle, bundle);
			const readExport = async (file: string) => {
				const bytes = exported.artifacts.get(file);
				assert.ok(bytes);
				return bytes;
			};
			const recovered = await compileVocabularies(
				{ format: 1, sources: exported.bundle.releases.map((release) => release.source) },
				readExport,
			);
			assert.deepEqual(recovered, bundle);
			await importVocabularyBundle(second, recovered, readExport);
			assert.deepEqual(
				(await second.select().from(tables.schemaTerm)).sort((a, b) => a.id.localeCompare(b.id)),
				(await db.select().from(tables.schemaTerm)).sort((a, b) => a.id.localeCompare(b.id)),
			);
		},
	);
	await step(
		"the same Drizzle relation contract splits into another table family and database",
		async () => {
			const familyFile = resolve(scratch, "family.ts"),
				config = resolve(scratch, "family.config.ts"),
				out = resolve(scratch, "family-migrations");
			await writeFile(
				familyFile,
				`import { defineRelationTables } from ${JSON.stringify(resolve(root, "src/drizzle.ts"))};\nconst family = defineRelationTables("media");\nexport const mediaRelation = family.relation;\nexport const mediaRevision = family.revision;\nexport const mediaSelection = family.selection;\n`,
			);
			await writeFile(
				config,
				`export default ${JSON.stringify({ dialect: "postgresql", schema: familyFile, out })};\n`,
			);
			await run("yarn", ["exec", "drizzle-kit", "generate", "--config", config], {
				cwd: root,
				timeout: 30_000,
			});
			const directory = (await readdir(out, { withFileTypes: true })).find((entry) =>
				entry.isDirectory(),
			);
			assert.ok(directory);
			await secondPool.query(await readFile(resolve(out, directory.name, "migration.sql"), "utf8"));
			const family = tables.defineRelationTables("media");
			await secondPool.query(relationIntegritySql(family));
			const changes = await db.select().from(tables.schemaChange),
				relations = await db.select().from(tables.schemaRelation);
			const revisions = await db.select().from(tables.schemaRelationRevision),
				selections = await db.select().from(tables.schemaRelationSelection);
			// JSON is the transport. Restore declared timestamp fields, not database-specific identity values.
			const portable = <T extends { createdAt: Date }>(rows: T[]): T[] =>
				JSON.parse(JSON.stringify(rows), (key, value) =>
					key === "createdAt" ? new Date(value) : value,
				);
			await second.transaction(async (tx) => {
				await tx.insert(tables.schemaChange).values(portable(changes));
				await tx.insert(family.relation).values(portable(relations));
				for (const row of [...revisions].sort(
					(a, b) => Number(Boolean(a.parentRevisionId)) - Number(Boolean(b.parentRevisionId)),
				))
					await tx.insert(family.revision).values(portable([row]));
				await tx.insert(family.selection).values(portable(selections));
			});
			assert.deepEqual(
				(await second.select().from(family.revision)).sort((a, b) => a.id.localeCompare(b.id)),
				revisions.sort((a, b) => a.id.localeCompare(b.id)),
			);
			assert.deepEqual(
				(await second.select().from(family.selection)).sort((a, b) => a.id.localeCompare(b.id)),
				selections.sort((a, b) => a.id.localeCompare(b.id)),
			);
			await rejectCode(
				() =>
					second
						.update(family.revision)
						.set({ position: "4" })
						.where(eq(family.revision.id, first.id)),
				"23514",
			);
		},
	);
	await step("new aliases cannot steal a previously assigned logical identity", async () => {
		const iri = "http://schema.org/FutureExampleTerm";
		await db.insert(tables.schemaTerm).values({ id: termId(iri), iri, iriHash: digest(iri) });
		const text =
			"<https://schema.org/FutureExampleTerm> a <http://www.w3.org/2000/01/rdf-schema#Class> .";
		const source = {
			...registry.release("schemaorg").source,
			version: "fixture-future",
			sha256: digest(text),
			bytes: Buffer.byteLength(text),
		};
		const future = await compileVocabularies({ format: 1, sources: [source] }, async () =>
			Buffer.from(text),
		);
		await assert.rejects(
			importVocabularyBundle(db, future, async () => Buffer.from(text)),
			/existing term identity/u,
		);
		assert.equal(
			(
				await db
					.select()
					.from(tables.schemaTerm)
					.where(eq(tables.schemaTerm.id, termId("https://schema.org/FutureExampleTerm")))
			).length,
			0,
		);
	});
	console.info(
		JSON.stringify(
			{
				postgres: version,
				passed: passed.length,
				cases: passed,
				terms: bundle.terms.length,
				retainedQuads: bundle.releases.reduce((n, r) => n + r.quadCount, 0),
			},
			null,
			2,
		),
	);
} catch (error) {
	console.error(`Schema PostgreSQL qualification failed after ${passed.length} cases`);
	throw error;
} finally {
	for (const pool of pools) await pool.end();
	if (started)
		await run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { timeout: 30_000 });
	await rm(scratch, { recursive: true, force: true });
}
