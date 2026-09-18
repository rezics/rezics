import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { catalogSourceMappingClaim } from "@rezics/schema/postgres/ingestion/source";
import { CatalogStructureSourceTables } from "@rezics/schema/postgres/ingestion/structure-source";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import {
	catalogDefinition,
	catalogDefinitionRevision,
} from "@rezics/schema/postgres/catalog/identity";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { VndbDumpContractSha256, vndbSourceKey } from "../src/services/catalog/vndb";
import { adoptVndbVn } from "../src/services/catalog/vndb-adoption";
import { adoptVndbAnime, createVndbAnimeNativeWriter } from "../src/services/catalog/vndb-anime";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import {
	addCatalogName,
	listCatalogNames,
	readCatalogFactNodes,
	findCatalogRelations,
} from "../src/services/catalog/storage";
import { addCatalogIdentifier } from "../src/services/catalog/identifiers";
import { listCatalogFacts } from "../src/services/catalog/semantic-history";
import { readProgramStructure, updateProgramStructure } from "../src/services/catalog/program";
import {
	readStructureComponentHead,
	programStructureRevisionValue,
} from "../src/services/catalog/structure-history";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires isolated loopback Atlas target");
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = objects.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
const firstRecord = {
	id: 987001,
	ann_id: [1001],
	mal_id: [2001],
	type: "tv",
	year: 2001,
	title_romaji: "Anime Main A",
	title_kanji: "作品甲",
};
const secondRecord = {
	...firstRecord,
	ann_id: [1002],
	mal_id: [2001, 2002],
	type: "mov",
	year: 2002,
	title_romaji: "Anime Main B",
	title_kanji: "作品乙",
};
const key = { source: "vndb", objectType: "anime", externalId: String(firstRecord.id) },
	sourceRecordId = catalogSourceRecordId(key);
const vn = {
	vn: {
		id: "v987001",
		image: null,
		c_image: null,
		olang: "ja",
		c_votecount: 0,
		c_rating: null,
		c_average: null,
		c_length: null,
		c_lengthnum: 0,
		length: 0,
		devstatus: 0,
		alias: "",
		description: "",
	},
	titles: [{ id: "v987001", lang: "ja", title: "関連作品", latin: null, official: true }],
	editions: [],
	staff: [],
	seiyuu: [],
	staff_alias: [],
	relations: [],
	screenshots: [],
	images: [],
	links: [],
	extlinks: [],
	anime: [{ id: "v987001", aid: firstRecord.id }],
};
const firstBytes = Buffer.from(JSON.stringify(firstRecord)),
	secondBytes = Buffer.from(JSON.stringify(secondRecord)),
	vnBytes = Buffer.from(JSON.stringify(vn));
const firstReceipt = await storeCatalogSourcePayload(
		key,
		firstBytes,
		VndbDumpContractSha256,
		null,
		archive,
	),
	secondReceipt = await storeCatalogSourcePayload(
		key,
		secondBytes,
		VndbDumpContractSha256,
		null,
		archive,
	),
	vnReceipt = await storeCatalogSourcePayload(
		vndbSourceKey(vn.vn.id),
		vnBytes,
		VndbDumpContractSha256,
		null,
		archive,
	);
const pool = new Pool({ connectionString, max: 1, statement_timeout: 30000 });
const db = drizzle({ client: pool });
const rollback = new Error("rollback VNDB anime source fixture");
let assertions = 0;
try {
	try {
		await db.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "VNDB anime mirror fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				for (const id of [sourceRecordId, catalogSourceRecordId(vndbSourceKey(vn.vn.id))])
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								lane,
								routingBucket: aggregateRoutingBucket("source_record", id),
								maximumRows: 5000n,
								maximumBytes: 128000000n,
							})),
						)
						.onConflictDoNothing();
				const visualNovel = await adoptVndbVn(tx, actor.id, vnReceipt, vnBytes);
				if (visualNovel.status !== "created") throw new Error("Expected native VN");
				const bindings = CatalogFactTables.program.sourceBinding;
				const [linked] = await tx
					.select()
					.from(bindings)
					.where(eq(bindings.sourceRecordId, sourceRecordId))
					.limit(1);
				assert.ok(linked);
				const reference = { owner: "program" as const, id: linked.ownerId };
				const unobserved = await readProgramStructure(tx, reference, actor.id);
				assert.equal(unobserved.identity.shape, "program");
				assert.ok(
					"typeRevisionId" in unobserved.record && unobserved.record.typeRevisionId === null,
				);
				assertions += 2;
				const adopted = await adoptVndbAnime(tx, actor.id, firstReceipt, firstBytes);
				if (adopted.status !== "created") throw new Error("Expected mirror reference completion");
				assert.deepEqual(adopted.reference, reference);
				assertions++;
				const first = await readProgramStructure(tx, reference, actor.id);
				if (!("typeRevisionId" in first.record)) throw new Error("Expected native Program type");
				let revision = (
					await updateProgramStructure(tx, reference, actor.id, adopted.revision, {
						shape: "program",
						fields: { typeRevisionId: first.record.typeRevisionId, declaredMainEpisodeCount: 7 },
					})
				).revision;
				revision = (
					await addCatalogName(tx, reference, actor.id, revision, {
						value: "Human program name",
						languageTag: "en",
						kind: "human-title",
					})
				).revision;
				await addCatalogIdentifier(tx, reference, actor.id, revision, {
					namespace: "local.catalog",
					value: "HUMAN-ID",
				});
				const after = await recordCatalogSourceObservation(tx, secondReceipt);
				const [binding] = await tx
					.select()
					.from(catalogSourceMappingClaim)
					.where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId))
					.limit(1);
				assert.ok(binding);
				const writer = createVndbAnimeNativeWriter({
					before: { snapshotId: adopted.snapshotId, receipt: firstReceipt, bytes: firstBytes },
					after: { snapshotId: after.snapshot.id, receipt: secondReceipt, bytes: secondBytes },
				});
				const [yearDefinition] = await tx
					.select({ id: catalogDefinitionRevision.id })
					.from(catalogDefinition)
					.innerJoin(
						catalogDefinitionRevision,
						eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
					)
					.where(
						and(
							eq(catalogDefinition.namespace, "catalog.metadata"),
							eq(catalogDefinition.key, "program-start-year"),
						),
					)
					.limit(1);
				assert.ok(yearDefinition);
				const verify = async (updated: boolean) => {
					const head = await readStructureComponentHead(
						tx,
						reference,
						"program_work",
						reference.id,
					);
					assert.ok(head);
					const value = programStructureRevisionValue("program_work", head.value);
					if (value.shape !== "program") throw new Error("Expected Program structure");
					const [type] = await tx
						.select({ key: catalogDefinition.key })
						.from(catalogDefinitionRevision)
						.innerJoin(
							catalogDefinition,
							eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
						)
						.where(eq(catalogDefinitionRevision.id, value.fields.typeRevisionId!))
						.limit(1);
					assert.equal(type?.key, updated ? "film" : "television_series");
					assert.equal(value.fields.declaredMainEpisodeCount, 7);
					assertions += 2;
					const names = (await listCatalogNames(tx, reference, actor.id)).filter(
						(name) => name.state === "active",
					);
					assert.ok(
						names.some(
							(name) =>
								name.value === (updated ? secondRecord.title_romaji : firstRecord.title_romaji) &&
								name.languageTag === null &&
								name.derivationNameId === null,
						),
					);
					assert.ok(names.some((name) => name.value === "Human program name"));
					assertions += 2;
					const ids = CatalogNameTables.program.identifier;
					const claims = await tx
						.select()
						.from(ids)
						.where(and(eq(ids.ownerId, reference.id), eq(ids.state, "active")));
					assert.ok(
						claims.some(
							(claim) => claim.namespace === "local.catalog" && claim.value === "HUMAN-ID",
						),
					);
					assert.deepEqual(
						claims
							.filter((claim) => claim.namespace === "animenewsnetwork.anime")
							.map((claim) => claim.value),
						updated ? ["1002"] : ["1001"],
					);
					assert.deepEqual(
						claims
							.filter((claim) => claim.namespace === "myanimelist.anime")
							.map((claim) => claim.value)
							.sort(),
						updated ? ["2001", "2002"] : ["2001"],
					);
					assertions += 3;
					const facts = (
						await listCatalogFacts(tx, reference, actor.id, {
							definitionRevisionId: yearDefinition.id,
						})
					).filter((fact) => fact.state === "active");
					assert.equal(facts.length, 1);
					const year = facts[0];
					assert.ok(year);
					const [node] = await readCatalogFactNodes(tx, reference, actor.id, year.id);
					assert.equal(Number(node?.numberValue), updated ? 2002 : 2001);
					assertions++;
					const source = CatalogStructureSourceTables.program.occurrence;
					const [pure] = await tx
						.select()
						.from(source)
						.where(
							and(
								eq(source.sourceRecordId, sourceRecordId),
								eq(source.snapshotId, updated ? after.snapshot.id : adopted.snapshotId),
							),
						)
						.limit(1);
					assert.ok(pure);
					assert.equal(Reflect.get(pure.sourceValue.fields, "declaredMainEpisodeCount"), null);
					assert.deepEqual(pure.observedFields, ["typeRevisionId"]);
					assertions += 2;
				};
				for (let cycle = 0; cycle < 3; cycle++) {
					const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
						sourceRecordId,
						mappingKey: binding.mappingKey,
						snapshotId: after.snapshot.id,
						mappingVersion: "vndb.anime.1",
					});
					if (proposal.status !== "proposed") throw new Error("Expected anime update proposal");
					const decision = {
						sourceRecordId,
						proposalId: proposal.proposal.id,
						mappingVersion: "vndb.anime.1",
						reason: "Reviewed observed anime mirror update",
					};
					assert.equal(
						(
							await decideCatalogSourceProposal(
								tx,
								actor.id,
								{ ...decision, action: "apply" },
								writer,
							)
						).status,
						"applied",
					);
					assertions++;
					await verify(true);
					assert.equal(
						(
							await decideCatalogSourceProposal(
								tx,
								actor.id,
								{ ...decision, action: "withdraw" },
								writer,
							)
						).status,
						"withdrawn",
					);
					assertions++;
					await verify(false);
				}
				const [relationDefinition] = await tx
					.select({ id: catalogDefinitionRevision.id })
					.from(catalogDefinition)
					.innerJoin(
						catalogDefinitionRevision,
						eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
					)
					.where(
						and(
							eq(catalogDefinition.namespace, "catalog.semantic-relation"),
							eq(catalogDefinition.key, "related-program"),
						),
					)
					.limit(1);
				assert.ok(relationDefinition);
				assert.equal(
					(await findCatalogRelations(tx, visualNovel.reference, actor.id, relationDefinition.id))
						.length,
					1,
				);
				assertions++;
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ check: "vndb-anime-source", cycles: 3, assertions, rolledBack: true }),
	);
} finally {
	await pool.end();
}
