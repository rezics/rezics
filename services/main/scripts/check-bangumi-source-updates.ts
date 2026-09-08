import type { CatalogReference } from "../src/services/catalog/contracts";
import { programEpisode } from "../src/services/database/schema/catalog-program";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	catalogSourceRecordId,
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { BangumiSubjectContractSha256 } from "../src/services/catalog/bangumi";
import {
	BangumiArchiveContractSha256,
	adoptBangumiEntity,
	adoptBangumiProgramEpisode,
} from "../src/services/catalog/bangumi-adoption";
import { adoptBangumiSubject } from "../src/services/catalog/source-adoption";
import {
	createBangumiNativeWriter,
	prepareBangumiProposalDependencies,
} from "../src/services/catalog/bangumi-native";
import { resolveCatalogSourceChildCorrespondence } from "../src/services/catalog/source-child-correspondence";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { listCatalogNames, loadCatalogIdentity } from "../src/services/catalog/storage";
import { reviseCatalogName, requireCatalogNameRevision } from "../src/services/catalog/names";
import { catalogNameRevisionValues } from "../src/services/catalog/source-owned-compensation";
import { updateProgramStructure } from "../src/services/catalog/program";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable Bangumi fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1"].includes(target.hostname) ||
	target.port !== "25434" ||
	target.pathname !== "/rezics_atlas"
)
	throw new Error("Bangumi source fixture requires isolated loopback target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	db = drizzle({ client: pool });
const payloads = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		payloads.set(value.Key, new Uint8Array(value.Body));
	},
	async get({ Key }) {
		const body = payloads.get(Key);
		return { Body: body ? Readable.from([body]) : undefined };
	},
};
const subject = {
	id: 950001,
	type: 2,
	name: "Before",
	name_cn: "",
	summary: "",
	series: false,
	nsfw: false,
	locked: false,
	platform: "TV",
	images: { small: "", grid: "", large: "", medium: "", common: "" },
	infobox: [{ key: "别名", value: [{ v: "Stable alias" }] }],
	volumes: 0,
	eps: 12,
	total_episodes: 12,
	rating: { rank: 0, total: 0, score: 0, count: {} },
	collection: { wish: 0, collect: 0, doing: 0, on_hold: 0, dropped: 0 },
	tags: [],
	meta_tags: [],
};
const person = {
	id: 950002,
	name: "Before",
	type: 1,
	career: [],
	infobox: "{{Infobox person\n|别名={\n[Stable alias]\n}\n}}",
	summary: "",
	comments: 0,
	collects: 0,
};
const character = {
	id: 950003,
	name: "Before",
	role: 1,
	infobox: person.infobox,
	summary: "",
	comments: 0,
	collects: 0,
};
const episode = {
	id: 950004,
	subject_id: subject.id,
	name: "Before",
	name_cn: "",
	type: 0,
	sort: 1.5,
	airdate: "2024-02",
	duration: "24m",
	description: "",
	disc: 0,
};
const cases = [
	{
		kind: "subject",
		contract: BangumiSubjectContractSha256,
		before: subject,
		after: { ...subject, name: "After", eps: 13, total_episodes: 13 },
	},
	{
		kind: "person",
		contract: BangumiArchiveContractSha256,
		before: person,
		after: { ...person, name: "After" },
	},
	{
		kind: "character",
		contract: BangumiArchiveContractSha256,
		before: character,
		after: { ...character, name: "After" },
	},
	{
		kind: "episode",
		contract: BangumiArchiveContractSha256,
		before: episode,
		after: { ...episode, name: "After", sort: 2.5, duration: "25m" },
	},
];
let checks = 0;
const rollback = new Error("rollback Bangumi source update fixture");
try {
	try {
		await db.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Bangumi source fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning({ id: users.id });
			assert.ok(account);
			await runWithNativeFixtureActor(tx, account.id, async () => {
				for (const scenario of cases) {
					const key = {
							source: "bangumi",
							objectType: scenario.kind,
							externalId: String(scenario.before.id),
						},
						sourceRecordId = catalogSourceRecordId(key);
					await tx
						.insert(operationalCapacity)
						.values(
							["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
								routingBucket: aggregateRoutingBucket("source_record", sourceRecordId),
								lane,
								maximumRows: 10000n,
								maximumBytes: 64000000n,
							})),
						)
						.onConflictDoNothing();
					const snapshot = async (body: unknown) => {
						const bytes = Buffer.from(JSON.stringify(body));
						const receipt = await storeCatalogSourcePayload(
							key,
							bytes,
							scenario.contract,
							null,
							archive,
						);
						const document = await recordCatalogSourceDocument(tx, receipt, bytes);
						return { bytes, receipt, snapshotId: document.snapshot.id };
					};
					const before = await snapshot(scenario.before);
					const initial: { status: string; reference: CatalogReference; revision: number } =
						scenario.kind === "subject"
							? await adoptBangumiSubject(tx, account.id, before.receipt, before.bytes)
							: scenario.kind === "episode"
								? await adoptBangumiProgramEpisode(
										tx,
										account.id,
										before.receipt,
										before.bytes,
										"archive",
									)
								: await adoptBangumiEntity(tx, account.id, before.receipt, before.bytes, "archive");
					assert.equal(initial.status, "created");
					checks++;
					const reference = initial.reference,
						scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId);
					const initialNames = await listCatalogNames(tx, reference, account.id);
					const alias = initialNames.find((name) => name.value === "Stable alias");
					if (scenario.kind !== "episode") {
						assert.ok(alias);
						const original = await requireCatalogNameRevision(
							tx,
							reference,
							account.id,
							alias.id,
							alias.revision,
						);
						await reviseCatalogName(tx, reference, account.id, alias.id, alias.revision, {
							...catalogNameRevisionValues(original),
							value: "Human alias",
						});
					}
					if (scenario.kind === "episode") {
						await updateProgramStructure(
							tx,
							reference,
							account.id,
							(await loadCatalogIdentity(tx, reference, account.id, true)).revision,
							{
								shape: "episode",
								fields: {
									programId: (
										await tx
											.select()
											.from(programEpisode)
											.where(eq(programEpisode.id, reference.id))
									)[0]?.programId,
									sortNumber: 1.5,
									discNumber: 0,
									durationText: "24m",
									date: { year: 2024, month: 2, day: null },
									dateText: "2024-02",
									episodeNumber: 77,
								},
							},
						);
					}
					const after = await snapshot(scenario.after);
					const writer = createBangumiNativeWriter({ before, after });
					const mappingVersion =
						scenario.kind === "subject"
							? "bangumi.subject.1"
							: scenario.kind === "episode"
								? "bangumi.program-episode.1"
								: "bangumi.entity.1";
					let primaryId: string | undefined;
					for (let cycle = 0; cycle < 2; cycle++) {
						const proposed = await proposeCatalogSourceAdoption(tx, account.id, {
							sourceRecordId,
							mappingKey: scope.mappingKey,
							snapshotId: after.snapshotId,
							mappingVersion,
						});
						if (!("proposal" in proposed) || !proposed.proposal)
							throw new Error("Expected pending proposal");
						await prepareBangumiProposalDependencies(tx, account.id, {
							...after,
							sourceRecordId,
							proposalId: proposed.proposal.id,
						});
						const decision = {
							sourceRecordId,
							proposalId: proposed.proposal.id,
							mappingVersion,
							reason: "Qualify exact Bangumi native update and compensation",
						};
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									account.id,
									{ ...decision, action: "apply" },
									writer,
								)
							).status,
							"applied",
						);
						checks++;
						const names = await listCatalogNames(tx, reference, account.id),
							primary = names.find((name) => name.value === "After" && name.state === "active");
						assert.ok(primary);
						if (primaryId) assert.equal(primary.id, primaryId);
						primaryId = primary.id;
						checks++;
						if (alias) {
							assert.ok(
								names.some(
									(name) =>
										name.id === alias.id && name.value === "Human alias" && name.state === "active",
								),
							);
							checks++;
						}
						if (scenario.kind === "episode") {
							const [read] = await tx
								.select()
								.from(programEpisode)
								.where(eq(programEpisode.id, reference.id));
							assert.ok(read);
							assert.equal(Number(read.episodeNumber), 77);
							assert.equal(Number(read.sortNumber), 2.5);
							checks += 2;
						}
						assert.equal(
							(
								await decideCatalogSourceProposal(
									tx,
									account.id,
									{ ...decision, action: "withdraw" },
									writer,
								)
							).status,
							"withdrawn",
						);
						checks++;
						assert.ok(
							(await listCatalogNames(tx, reference, account.id)).some(
								(name) =>
									name.id === primary.id && name.value === "Before" && name.state === "active",
							),
						);
						checks++;
						if (scenario.kind === "episode") {
							const [read] = await tx
								.select()
								.from(programEpisode)
								.where(eq(programEpisode.id, reference.id));
							assert.ok(read);
							assert.equal(Number(read.episodeNumber), 77);
							assert.equal(Number(read.sortNumber), 1.5);
							checks += 2;
						}
					}
					const occurrences = CatalogNameTables[reference.owner].sourceOccurrence;
					assert.ok(
						(
							await tx
								.select()
								.from(occurrences)
								.where(
									and(
										eq(occurrences.ownerId, reference.id),
										eq(occurrences.snapshotId, after.snapshotId),
									),
								)
						).length > 0,
					);
					checks++;
				}
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({ checks, families: cases.map((item) => item.kind), cycles: 2, rollback: true }),
	);
} finally {
	await pool.end();
}
