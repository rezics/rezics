import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { operationalCapacity } from "@rezics/schema/postgres/operations/operational-durability";
import { catalogSourceMappingClaim } from "@rezics/schema/postgres/ingestion/source";
import {
	catalogDefinition,
	catalogDefinitionRevision,
} from "@rezics/schema/postgres/catalog/identity";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { VndbCatalogContractSha256, VndbDumpContractSha256 } from "../src/services/catalog/vndb";
import {
	catalogSourceRecordId,
	recordCatalogSourceObservation,
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import {
	adoptVndbStaff,
	adoptVndbProducer,
	adoptVndbCharacter,
} from "../src/services/catalog/vndb-entities";
import { adoptVndbSemanticObject } from "../src/services/catalog/vndb-semantics";
import { createVndbSupportingNativeWriter } from "../src/services/catalog/vndb-supporting-update";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { listCatalogFacts } from "../src/services/catalog/semantic-history";
import {
	listCatalogNames,
	loadCatalogIdentity,
	readCatalogFactNodes,
	findCatalogRelations,
} from "../src/services/catalog/storage";
import { EntityProfileSchema } from "../src/services/catalog/entity-contracts";
import { initializeEntityProfile } from "../src/services/catalog/entities";
import { readCatalogProfileHead } from "../src/services/catalog/profile-source";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires a disposable loopback Atlas target");
const archiveBytes = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		archiveBytes.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = archiveBytes.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
type Case = {
	dump?: boolean;
	relations?: { key: string; counts: [number, number] }[];
	spoilerName?: { value: string; values: [number, number] };
	kind: "staff" | "producer" | "character" | "tag" | "trait" | "quote" | "drm" | "engine";
	before: Record<string, unknown> & { id: string | number };
	after: Record<string, unknown> & { id: string | number };
	name?: [string, string];
	property?: {
		namespace: string;
		key: string;
		values: [string | number | boolean, string | number | boolean];
	};
};
function characterDump(updated: boolean) {
	return {
		id: "c985011",
		character: {
			id: "c985011",
			image: "ch985011",
			bloodt: "unknown",
			cup_size: "",
			sex: "m",
			spoil_sex: null,
			gender: null,
			spoil_gender: null,
			main: updated ? "c985001" : null,
			main_spoil: 2,
			s_bust: 0,
			s_waist: 0,
			s_hip: 0,
			birthday: 229,
			height: updated ? 171 : 170,
			weight: 0,
			age: null,
			description: "Character dump",
		},
		names: [
			{
				id: "c985011",
				lang: "ja",
				name: updated ? "人物乙" : "人物甲",
				latin: updated ? "Character B" : "Character A",
			},
		],
		aliases: [{ id: "c985011", name: "Hidden alias", latin: null, spoil: updated ? 2 : 1 }],
		traits: updated ? [{ id: "c985011", tid: "i985001", spoil: 1, lie: true }] : [],
		vns: updated ? [{ id: "c985011", vid: "v985009", rid: "r985011", role: "main", spoil: 1 }] : [],
		images: [
			{
				id: "ch985011",
				width: updated ? 601 : 600,
				height: 800,
				c_votecount: 2,
				c_sexual_avg: 100,
				c_violence_avg: 0,
			},
		],
	};
}
const cases: Case[] = [
	{
		kind: "character",
		dump: true,
		before: characterDump(false),
		after: characterDump(true),
		name: ["人物甲", "人物乙"],
		property: { namespace: "catalog", key: "character.height", values: [170, 171] },
		spoilerName: { value: "Hidden alias", values: [1, 2] },
		relations: [
			{ key: "instance-of-character", counts: [0, 1] },
			{ key: "has-character-trait", counts: [0, 1] },
			{ key: "character-appears-in", counts: [0, 1] },
			{ key: "has-image", counts: [1, 1] },
		],
	},
	{
		kind: "staff",
		dump: true,
		before: {
			id: "s985011",
			staff: {
				id: "s985011",
				gender: "m",
				lang: "en",
				main: 985011,
				description: "Dump description A",
				prod: null,
			},
			aliases: [{ id: "s985011", aid: 985011, name: "Dump staff A", latin: null }],
			links: [{ id: "s985011", link: 1 }],
			extlinks: [{ id: 1, site: "website", value: "https://example.invalid/a" }],
		},
		after: {
			id: "s985011",
			staff: {
				id: "s985011",
				gender: "f",
				lang: "en",
				main: 985011,
				description: "Dump description B",
				prod: "p985011",
			},
			aliases: [
				{ id: "s985011", aid: 985011, name: "Dump staff B", latin: null },
				{ id: "s985011", aid: 985012, name: "New dump alias", latin: null },
			],
			links: [{ id: "s985011", link: 2 }],
			extlinks: [{ id: 2, site: "website", value: "https://example.invalid/b" }],
		},
		name: ["Dump staff A", "Dump staff B"],
		relations: [
			{ key: "has-linked-producer-profile", counts: [0, 1] },
			{ key: "external-link", counts: [1, 1] },
		],
		property: {
			namespace: "catalog.metadata",
			key: "description.vndb-markup",
			values: ["Dump description A", "Dump description B"],
		},
	},
	{
		kind: "producer",
		dump: true,
		before: {
			id: "p985011",
			producer: {
				id: "p985011",
				type: "co",
				lang: "en",
				name: "Dump producer A",
				latin: null,
				alias: "",
				description: "Producer A",
			},
			relations: [],
			links: [],
			extlinks: [],
		},
		after: {
			id: "p985011",
			producer: {
				id: "p985011",
				type: "co",
				lang: "en",
				name: "Dump producer B",
				latin: null,
				alias: "New producer alias",
				description: "Producer B",
			},
			relations: [{ id: "p985011", pid: "p985001", relation: "sub" }],
			links: [],
			extlinks: [],
		},
		name: ["Dump producer A", "Dump producer B"],
		relations: [{ key: "has-subsidiary", counts: [0, 1] }],
		property: {
			namespace: "catalog.metadata",
			key: "description.vndb-markup",
			values: ["Producer A", "Producer B"],
		},
	},
	{
		kind: "staff",
		before: {
			id: "s985001",
			aid: 985001,
			ismain: true,
			name: "Staff A",
			original: null,
			lang: "en",
			gender: "m",
			aliases: [{ aid: 985001, name: "Staff A", latin: null, ismain: true }],
		},
		after: {
			id: "s985001",
			aid: 985001,
			ismain: true,
			name: "Staff B",
			original: null,
			lang: "en",
			gender: "f",
			aliases: [
				{ aid: 985001, name: "Staff B", latin: null, ismain: true },
				{ aid: 985002, name: "別名", latin: "Betsumei", ismain: false },
			],
		},
		name: ["Staff A", "Staff B"],
	},
	{
		kind: "producer",
		before: {
			id: "p985001",
			name: "Studio A",
			original: null,
			lang: "ja",
			type: "co",
			aliases: ["Old alias"],
			description: "Old description",
		},
		after: {
			id: "p985001",
			name: "Studio B",
			original: null,
			lang: "ja",
			type: "co",
			aliases: ["New alias"],
			description: "New description",
		},
		name: ["Studio A", "Studio B"],
		property: {
			namespace: "catalog.metadata",
			key: "description.vndb-markup",
			values: ["Old description", "New description"],
		},
	},
	{
		kind: "character",
		before: { id: "c985001", name: "Character A", aliases: [], height: 165, gender: ["f", "f"] },
		after: {
			id: "c985001",
			name: "Character B",
			aliases: ["Alias"],
			height: 170,
			gender: ["f", "a"],
		},
		name: ["Character A", "Character B"],
		property: { namespace: "catalog", key: "character.height", values: [165, 170] },
	},
	{
		kind: "tag",
		before: {
			id: "g985001",
			name: "Tag A",
			aliases: [],
			searchable: false,
			applicable: true,
			category: "cont",
		},
		after: {
			id: "g985001",
			name: "Tag B",
			aliases: ["Tag alias"],
			searchable: true,
			applicable: true,
			category: "cont",
		},
		name: ["Tag A", "Tag B"],
		property: {
			namespace: "source.vndb.qualifier",
			key: "taxonomy-searchable",
			values: [false, true],
		},
	},
	{
		kind: "trait",
		before: { id: "i985001", name: "Trait A", aliases: [], sexual: false },
		after: { id: "i985001", name: "Trait B", aliases: [], sexual: true },
		name: ["Trait A", "Trait B"],
		property: { namespace: "source.vndb.qualifier", key: "taxonomy-sexual", values: [false, true] },
	},
	{
		kind: "quote",
		before: { id: "q985001", quote: "Quotation A", vn: { id: "v985009" }, character: null },
		after: { id: "q985001", quote: "Quotation B", vn: { id: "v985009" }, character: null },
		property: {
			namespace: "catalog.metadata",
			key: "quotation-text",
			values: ["Quotation A", "Quotation B"],
		},
	},
	{
		kind: "drm",
		before: {
			id: 985001,
			name: "Access A",
			disc: false,
			cdkey: false,
			activate: false,
			alimit: false,
			account: false,
			online: false,
			cloud: false,
			physical: false,
		},
		after: {
			id: 985001,
			name: "Access B",
			disc: false,
			cdkey: false,
			activate: true,
			alimit: false,
			account: false,
			online: false,
			cloud: false,
			physical: false,
		},
		name: ["Access A", "Access B"],
		property: {
			namespace: "catalog.metadata",
			key: "requires-online-activation",
			values: [false, true],
		},
	},
	{
		kind: "engine",
		before: { id: 985001, name: "Engine A", description: "Description A" },
		after: { id: 985001, name: "Engine B", description: "Description B" },
		name: ["Engine A", "Engine B"],
		property: {
			namespace: "catalog.metadata",
			key: "engine-description",
			values: ["Description A", "Description B"],
		},
	},
];
const pool = new Pool({ connectionString, max: 1, statement_timeout: 30000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback VNDB supporting updates");
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "VNDB supporting fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning();
			assert.ok(actor);
			await runWithNativeFixtureActor(tx, actor.id, async () => {
				const keys = [
					...cases.map((entry) => ({
						source: "vndb",
						objectType: entry.kind,
						externalId: String(entry.before.id),
					})),
					{ source: "vndb", objectType: "vn", externalId: "v985009" },
					{ source: "vndb", objectType: "release", externalId: "r985011" },
					{ source: "vndb", objectType: "image", externalId: "ch985011" },
				];
				for (const routingBucket of new Set(
					keys.map((key) => aggregateRoutingBucket("source_record", catalogSourceRecordId(key))),
				))
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket,
								lane,
								maximumRows: 10000n,
								maximumBytes: 256_000_000n,
							})),
						)
						.onConflictDoNothing();
				for (const entry of cases) {
					const key = {
							source: "vndb",
							objectType: entry.kind,
							externalId: String(entry.before.id),
						},
						sourceRecordId = catalogSourceRecordId(key);
					const contract =
						entry.dump || entry.kind === "drm" || entry.kind === "engine"
							? VndbDumpContractSha256
							: VndbCatalogContractSha256;
					const beforeBytes = Buffer.from(JSON.stringify(entry.before)),
						afterBytes = Buffer.from(JSON.stringify(entry.after));
					const beforeReceipt = await storeCatalogSourcePayload(
							key,
							beforeBytes,
							contract,
							null,
							archive,
						),
						afterReceipt = await storeCatalogSourcePayload(
							key,
							afterBytes,
							contract,
							null,
							archive,
						);
					const adopted:
						| Awaited<ReturnType<typeof adoptVndbStaff>>
						| Awaited<ReturnType<typeof adoptVndbSemanticObject>> =
						entry.kind === "staff"
							? await adoptVndbStaff(tx, actor.id, beforeReceipt, beforeBytes)
							: entry.kind === "producer"
								? await adoptVndbProducer(tx, actor.id, beforeReceipt, beforeBytes)
								: entry.kind === "character"
									? await adoptVndbCharacter(tx, actor.id, beforeReceipt, beforeBytes)
									: await adoptVndbSemanticObject(tx, actor.id, beforeReceipt, beforeBytes);
					if (adopted.status !== "created") throw new Error(`Expected initial ${entry.kind}`);
					const reference: CatalogReference = adopted.reference;
					if (entry.dump && entry.kind === "staff") {
						assert.equal(
							(await loadCatalogIdentity(tx, reference, actor.id, false)).shape,
							"unresolved",
						);
						assertions++;
					}
					if (entry.kind === "staff") {
						const head = await readCatalogProfileHead(tx, reference, actor.id);
						assert.ok(head);
						const native = await loadCatalogIdentity(tx, reference, actor.id, true);
						await initializeEntityProfile(tx, reference, actor.id, native.revision, {
							...EntityProfileSchema.parse(head.snapshot),
							begin: { year: 2000, month: null, day: null },
						});
					}
					const observed = await recordCatalogSourceObservation(tx, afterReceipt);
					const [binding] = await tx
						.select()
						.from(catalogSourceMappingClaim)
						.where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId));
					assert.ok(binding);
					const writer = createVndbSupportingNativeWriter({
						before: { snapshotId: adopted.snapshotId, receipt: beforeReceipt, bytes: beforeBytes },
						after: { snapshotId: observed.snapshot.id, receipt: afterReceipt, bytes: afterBytes },
					});
					const verify = async (index: 0 | 1) => {
						if (entry.spoilerName) {
							const alias = (await listCatalogNames(tx, reference, actor.id)).find(
								(name) => name.state === "active" && name.value === entry.spoilerName?.value,
							);
							assert.equal(alias?.spoiler, entry.spoilerName.values[index]);
							assertions++;
						}
						for (const relation of entry.relations ?? []) {
							const [definition] = await tx
								.select({ id: catalogDefinitionRevision.id })
								.from(catalogDefinition)
								.innerJoin(
									catalogDefinitionRevision,
									eq(catalogDefinitionRevision.definitionId, catalogDefinition.id),
								)
								.where(
									and(
										eq(catalogDefinition.namespace, "catalog.semantic-relation"),
										eq(catalogDefinition.key, relation.key),
									),
								)
								.limit(1);
							assert.ok(definition);
							assert.equal(
								(
									await findCatalogRelations(tx, reference, actor.id, definition.id, {
										maxSpoiler: 2,
									})
								).length,
								relation.counts[index],
							);
							assertions++;
						}
						if (entry.name) {
							assert.ok(
								(await listCatalogNames(tx, reference, actor.id)).some(
									(name) => name.state === "active" && name.value === entry.name?.[index],
								),
							);
							assertions++;
						}
						if (entry.property) {
							const property = entry.property;
							const [definition] = await tx
								.select({ id: catalogDefinitionRevision.id })
								.from(catalogDefinition)
								.innerJoin(
									catalogDefinitionRevision,
									eq(catalogDefinitionRevision.definitionId, catalogDefinition.id),
								)
								.where(
									and(
										eq(catalogDefinition.namespace, property.namespace),
										eq(catalogDefinition.key, property.key),
									),
								)
								.limit(1);
							assert.ok(definition);
							const facts = (
								await listCatalogFacts(tx, reference, actor.id, {
									definitionRevisionId: definition.id,
									maxSpoiler: 2,
								})
							).filter((fact) => fact.state === "active");
							assert.equal(facts.length, 1);
							const [fact] = facts;
							assert.ok(fact);
							const [node] = await readCatalogFactNodes(tx, reference, actor.id, fact.id, -1, 1, 2);
							assert.ok(node);
							const value =
								node.kind === "number"
									? Number(node.numberValue)
									: node.kind === "boolean"
										? node.booleanValue
										: node.textValue;
							assert.equal(value, property.values[index]);
							assertions++;
						}
						if (entry.kind === "staff") {
							const head = await readCatalogProfileHead(tx, reference, actor.id);
							assert.ok(head);
							const profile = EntityProfileSchema.parse(head.snapshot);
							assert.equal(profile.begin?.year, 2000);
							assertions++;
							const [definition] = await tx
								.select({ key: catalogDefinition.key })
								.from(catalogDefinitionRevision)
								.innerJoin(
									catalogDefinition,
									eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
								)
								.where(eq(catalogDefinitionRevision.id, profile.genderRevisionId!));
							assert.equal(definition?.key, index === 0 ? "male" : "female");
							assertions++;
						}
					};
					for (let cycle = 0; cycle < 3; cycle++) {
						const proposal = await proposeCatalogSourceAdoption(tx, actor.id, {
							sourceRecordId,
							mappingKey: binding.mappingKey,
							snapshotId: observed.snapshot.id,
							mappingVersion: binding.mappingVersion,
						});
						if (proposal.status !== "proposed") throw new Error(`Expected ${entry.kind} proposal`);
						const decision: {
							sourceRecordId: string;
							proposalId: string;
							mappingVersion: string;
							reason: string;
						} = {
							sourceRecordId,
							proposalId: proposal.proposal.id,
							mappingVersion: binding.mappingVersion,
							reason: "Reviewed supporting source fixture",
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
						await verify(1);
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
						await verify(0);
					}
				}
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			check: "vndb-supporting-updates",
			families: cases.length,
			cyclesPerFamily: 3,
			assertions,
			rolledBack: true,
		}),
	);
} finally {
	await pool.end();
}
