import assert from "node:assert/strict";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import {
	adoptBangumiIndex,
	adoptBangumiIndexMember,
	ensureBangumiIndexMemberDefinitions,
} from "../src/services/catalog/bangumi-index";
import {
	BangumiApiContractSha256,
	adoptBangumiWikiValue,
} from "../src/services/catalog/bangumi-adoption";
import { BangumiSubjectContractSha256 } from "../src/services/catalog/bangumi";
import { adoptBangumiSubject } from "../src/services/catalog/source-adoption";
import { ensureCatalogDefinition, loadCatalogIdentity } from "../src/services/catalog/storage";
import {
	storeCatalogSourcePayload,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { readGroupingOrder } from "../src/services/catalog/grouping";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Bangumi acceptance requires an isolated rezics_atlas database");
const payloads = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		payloads.set(input.Key, new Uint8Array(input.Body));
	},
	async get(input) {
		const value = payloads.get(input.Key);
		return { Body: value ? Readable.from([value]) : undefined };
	},
};
async function archived(
	objectType: string,
	externalId: string,
	body: unknown,
	contract = BangumiApiContractSha256,
) {
	const bytes = Buffer.from(JSON.stringify(body));
	const receipt = await storeCatalogSourcePayload(
		{ source: "bangumi", objectType, externalId },
		bytes,
		contract,
		null,
		archive,
	);
	return { receipt, bytes };
}
const images = { small: "", grid: "", large: "", medium: "", common: "" };
const subjectBody = {
	id: 253,
	type: 2,
	name: "Program",
	name_cn: "",
	summary: "",
	series: false,
	nsfw: false,
	locked: false,
	platform: "TV",
	images,
	infobox: [],
	volumes: 0,
	eps: 13,
	total_episodes: 13,
	rating: { rank: 1, total: 1, score: 8, count: { "8": 1 } },
	collection: { wish: 0, collect: 1, doing: 0, on_hold: 0, dropped: 0 },
	tags: [],
	meta_tags: [],
};
const subject = await archived("subject", "253", subjectBody, BangumiSubjectContractSha256);
const index = await archived("index", "1", {
	id: 1,
	title: "Curated programs",
	desc: "A curator's selection",
	created_at: "2010-06-05T20:36:14+08:00",
	updated_at: "2025-05-09T22:20:08+08:00",
	creator: { username: "curator", nickname: "Curator" },
	total: 1,
	stat: { comments: 2, collects: 16 },
	nsfw: false,
	ban: false,
});
const members = await archived("index_subjects", "1:0", {
	data: [
		{
			id: 253,
			type: 2,
			name: "Program",
			name_cn: "",
			date: "1998-10-23",
			images,
			infobox: [],
			comment: "Watch the original version",
			added_at: "2025-05-09T22:20:08+08:00",
		},
	],
	total: 1,
	limit: 50,
	offset: 0,
});
const revisionBody = {
	id: 679589,
	type: 2,
	created_at: "2017-03-10T22:50:30+08:00",
	creator: { username: "curator", nickname: "Curator" },
	summary: "",
	data: { field_infobox: "{{Infobox animanga/TVAnime\n|name=Historical program\n}}" },
};
const historical = await archived("subject_revision", "679589", revisionBody);
const membership = await archived("subject_revisions", "253:0", {
	data: [{ ...revisionBody, data: null }],
	total: 1,
	limit: 50,
	offset: 0,
});
const wrongMembership = await archived("subject_revisions", "254:0", {
	data: [{ ...revisionBody, data: null }],
	total: 1,
	limit: 50,
	offset: 0,
});
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback Bangumi native fixture");
let checks = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const buckets = new Set(
				[subject, index, members, historical, membership, wrongMembership].map(({ receipt }) =>
					aggregateRoutingBucket("source_record", catalogSourceRecordId(receipt.key)),
				),
			);
			for (const routingBucket of buckets)
				await tx
					.insert(operationalCapacity)
					.values(
						["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
							routingBucket,
							lane,
							maximumRows: 10000n,
							maximumBytes: 100000000n,
						})),
					)
					.onConflictDoNothing();
			const [account] = await tx
				.insert(users)
				.values({ name: "Bangumi native fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			await runWithNativeFixtureActor(tx, actor, async () => {
				const program = await adoptBangumiSubject(tx, actor, subject.receipt, subject.bytes);
				const grouping = await adoptBangumiIndex(tx, actor, index.receipt, index.bytes);
				assert.equal(grouping.status, "created");
				if (!("orderProfileId" in grouping))
					throw new Error("Expected new collection order profile");
				const names = CatalogNameTables.grouping.sourceOccurrence;
				assert.equal(
					(await tx.select().from(names).where(eq(names.ownerId, grouping.reference.id))).length,
					1,
				);
				checks++;
				const definitions = await ensureBangumiIndexMemberDefinitions(tx);
				await adoptBangumiIndexMember(tx, grouping.reference, actor, grouping.revision, {
					...members,
					entryIndex: 0,
					profileId: grouping.orderProfileId,
					position: "a0",
					...definitions,
				});
				const ordered = await readGroupingOrder(
					tx,
					grouping.reference,
					actor,
					grouping.orderProfileId,
				);
				assert.equal(ordered.length, 1);
				const supports = CatalogFactTables.grouping.support;
				const sources = await tx
					.select()
					.from(supports)
					.where(eq(supports.ownerId, grouping.reference.id));
				for (const path of [
					"/title",
					"/desc",
					"/total",
					"/stat/comments",
					"/stat/collects",
					"/created_at",
					"/updated_at",
					"/ban",
					"/data/0/comment",
					"/data/0/added_at",
				])
					assert.ok(
						sources.some((row) => row.sourcePath === path),
						`Missing native source support ${path}`,
					);
				checks += 2;
				const wikiDefinition = await ensureCatalogDefinition(tx, {
					namespace: "catalog.metadata",
					key: "historical-name-note",
					kind: "property",
					valueKind: "string",
				});
				const current = await loadCatalogIdentity(tx, program.reference, actor, true);
				const input = {
					...historical,
					entryIndex: 0,
					definitionRevisionId: wikiDefinition.revisionId,
					revisionTarget: { objectType: "subject" as const, externalId: 253 },
				};
				await assert.rejects(
					() =>
						tx.transaction((savepoint) =>
							adoptBangumiWikiValue(savepoint, program.reference, actor, current.revision, input),
						),
					/membership evidence/,
				);
				await assert.rejects(
					() =>
						tx.transaction((savepoint) =>
							adoptBangumiWikiValue(savepoint, program.reference, actor, current.revision, {
								...input,
								revisionContext: { ...wrongMembership, entryIndex: 0 },
							}),
						),
					/membership evidence/,
				);
				const wiki = await adoptBangumiWikiValue(tx, program.reference, actor, current.revision, {
					...input,
					revisionContext: { ...membership, entryIndex: 0 },
				});
				const evidence = CatalogFactTables.program.support;
				const wikiProofs = await tx
					.select()
					.from(evidence)
					.where(and(eq(evidence.ownerId, program.reference.id), eq(evidence.factId, wiki.id)));
				assert.equal(wikiProofs.length, 2);
				assert.deepEqual(
					new Set(wikiProofs.map((row) => row.sourcePath)),
					new Set(["/data/field_infobox", "/data/0/id"]),
				);
				checks += 3;
				throw rollback;
			});
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			checks,
			rolledBack: true,
			scope: "Bangumi native index annotation and historical wiki membership",
		}),
	);
} finally {
	await pool.end();
}
