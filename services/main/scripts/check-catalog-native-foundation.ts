import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import {
	CatalogIdentityTables,
	catalogDefinitionRevision,
	catalogUnitLocator,
} from "../src/services/database/schema/catalog-identity";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
} from "../src/services/database/schema/catalog-source";
import {
	addCatalogName,
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogIdentity,
	createCatalogRelation,
	ensureCatalogDefinition,
	findCatalogRelations,
	readCatalogFactNodes,
	readCatalogParticipants,
	resolveCatalogIdentity,
	sealCatalogFact,
} from "../src/services/catalog/storage";
import {
	assignGroupingClass,
	createGroupingOrderProfile,
	orderGroupingRelation,
	readGroupingOrder,
} from "../src/services/catalog/grouping";
import { catalogValueNodes } from "../src/services/catalog/value-nodes";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== "/rezics" ||
	url.port !== (process.env.POSTGRES_LOCAL_PORT ?? "15432")
)
	throw new Error("Catalog acceptance requires the loopback rezics-dev database");

const pool = new Pool({ connectionString, max: 4, statement_timeout: 10_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback native catalog acceptance fixture");
let assertions = 0;

function postgresError(error: unknown): { code: string; constraint?: string } | null {
	let current = error;
	for (let depth = 0; depth < 6 && current; depth++) {
		const parsed = z
			.object({ code: z.string(), constraint: z.string().optional() })
			.safeParse(current);
		if (parsed.success) return parsed.data;
		current = current instanceof Error ? current.cause : undefined;
	}
	return null;
}

async function rejected(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
	code: string,
	constraint?: string,
) {
	await assert.rejects(tx.transaction(work), (error: unknown) => {
		const parsed = postgresError(error);
		return parsed?.code === code && (constraint === undefined || parsed.constraint === constraint);
	});
	assertions++;
}

try {
	try {
		await database.transaction(async (tx) => {
			const [actorRow] = await tx
				.insert(users)
				.values({
					name: "Catalog acceptance fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actorRow);
			const actor = actorRow.id;
			const universeClass = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "universe",
				kind: "class",
				valueKind: null,
			});
			const franchiseClass = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "franchise",
				kind: "class",
				valueKind: null,
			});
			const seriesClass = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "series",
				kind: "class",
				valueKind: null,
			});
			const setIn = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "set_in_universe",
				kind: "predicate",
				valueKind: null,
			});
			const about = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "about",
				kind: "predicate",
				valueKind: null,
			});
			const subject = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "subject",
				kind: "role",
				valueKind: null,
			});
			const object = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "object",
				kind: "role",
				valueKind: null,
			});
			const context = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "context",
				kind: "role",
				valueKind: null,
			});
			const infobox = await ensureCatalogDefinition(tx, {
				namespace: "acceptance",
				key: "ordered_infobox",
				kind: "property",
				valueKind: "array",
			});
			const groups = [];
			for (const classification of [universeClass, franchiseClass, seriesClass]) {
				const group = await createCatalogIdentity(
					tx,
					{ owner: "grouping", shape: "grouping", visibility: "public", status: "published" },
					actor,
				);
				const named = await addCatalogName(tx, group, actor, group.revision, {
					languageTag: "zh-Hans",
					kind: "primary",
					value: "同名编目验收对象",
				});
				const assigned = await assignGroupingClass(
					tx,
					group,
					actor,
					named.revision,
					classification.revisionId,
				);
				groups.push({ ...group, revision: assigned.revision });
			}
			const [universe, franchise, series] = groups;
			assert.ok(universe && franchise && series);
			assert.equal(new Set(groups.map(({ id }) => id)).size, 3);
			assert.equal((await resolveCatalogIdentity(tx, universe.id, null)).owner, "grouping");
			const legacyCount = await tx.execute<{ present: boolean }>(
				sql`select exists(select 1 from public.unit where id = ${universe.id}::uuid) as present`,
			);
			assert.equal(legacyCount.rows[0]?.present, false);
			assertions += 3;

			const work = await createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "work", visibility: "public", status: "published" },
				actor,
			);
			const commentary = await createCatalogIdentity(
				tx,
				{ owner: "program", shape: "video", visibility: "public", status: "published" },
				actor,
			);
			const firstContinuity = await createCatalogIdentity(
				tx,
				{ owner: "grouping", shape: "continuity", visibility: "public", status: "published" },
				actor,
			);
			const secondContinuity = await createCatalogIdentity(
				tx,
				{ owner: "grouping", shape: "continuity", visibility: "public", status: "published" },
				actor,
			);
			const membership = await createCatalogRelation(tx, universe, actor, universe.revision, {
				definitionRevisionId: setIn.revisionId,
				participants: [
					{ roleRevisionId: subject.revisionId, target: work },
					{ roleRevisionId: object.revisionId, target: universe },
					{ roleRevisionId: context.revisionId, target: firstContinuity },
				],
			});
			universe.revision = membership.revision;
			const commentaryRelation = await createCatalogRelation(
				tx,
				universe,
				actor,
				universe.revision,
				{
					definitionRevisionId: about.revisionId,
					participants: [
						{ roleRevisionId: subject.revisionId, target: commentary },
						{ roleRevisionId: object.revisionId, target: universe },
						{ roleRevisionId: context.revisionId, target: secondContinuity },
					],
				},
			);
			universe.revision = commentaryRelation.revision;
			assert.deepEqual(
				(await findCatalogRelations(tx, universe, null, setIn.revisionId)).map(({ id }) => id),
				[membership.id],
			);
			assert.deepEqual(
				(await findCatalogRelations(tx, universe, null, about.revisionId)).map(({ id }) => id),
				[commentaryRelation.id],
			);
			assert.equal(
				(await readCatalogParticipants(tx, universe, membership.id, null)).find(
					({ roleRevisionId }) => roleRevisionId === context.revisionId,
				)?.groupingId,
				firstContinuity.id,
			);
			assertions += 3;

			assert.equal(
				(
					await findCatalogRelations(tx, universe, null, setIn.revisionId, {
						participants: [
							{ roleRevisionId: subject.revisionId, target: work },
							{ roleRevisionId: context.revisionId, target: secondContinuity },
						],
					})
				).length,
				0,
			);
			assert.deepEqual(
				(
					await findCatalogRelations(tx, universe, null, setIn.revisionId, {
						participants: [
							{ roleRevisionId: subject.revisionId, target: work },
							{ roleRevisionId: context.revisionId, target: firstContinuity },
						],
					})
				).map(({ id }) => id),
				[membership.id],
			);
			assertions += 2;

			const releaseOrder = await createGroupingOrderProfile(
				tx,
				universe,
				actor,
				universe.revision,
				"release",
			);
			universe.revision = releaseOrder.revision;
			const chronology = await createGroupingOrderProfile(
				tx,
				universe,
				actor,
				universe.revision,
				"chronology",
			);
			universe.revision = chronology.revision;
			for (const entry of [
				{ profileId: releaseOrder.id, relationId: membership.id, position: "a0" },
				{ profileId: releaseOrder.id, relationId: commentaryRelation.id, position: "a1" },
				{ profileId: chronology.id, relationId: commentaryRelation.id, position: "a0" },
				{ profileId: chronology.id, relationId: membership.id, position: "a1" },
			])
				universe.revision = (
					await orderGroupingRelation(tx, universe, actor, universe.revision, entry)
				).revision;
			assert.deepEqual(
				(await readGroupingOrder(tx, universe, null, releaseOrder.id)).map(
					({ relationId }) => relationId,
				),
				[membership.id, commentaryRelation.id],
			);
			assert.deepEqual(
				(await readGroupingOrder(tx, universe, null, chronology.id)).map(
					({ relationId }) => relationId,
				),
				[commentaryRelation.id, membership.id],
			);
			assertions += 2;

			const values = Array.from({ length: 520 }, (_, i) => ({
				key: "repeated",
				value: i === 519 ? [null, false, 1.5] : `name-${i}`,
			}));
			const fact = await beginCatalogFact(tx, work, actor, work.revision, infobox.revisionId);
			let factVersion = fact.revision;
			let lastPosition = -1;
			const nodes = [...catalogValueNodes(values)];
			for (let offset = 0; offset < nodes.length; offset += 512) {
				const appended = await appendCatalogFactNodes(
					tx,
					work,
					actor,
					factVersion,
					fact.id,
					lastPosition,
					nodes.slice(offset, offset + 512),
				);
				factVersion = appended.revision;
				lastPosition = appended.lastNodePosition;
			}
			const sealed = await sealCatalogFact(tx, work, actor, factVersion, fact.id, lastPosition);
			const recovered = [];
			for (let after = -1; ; ) {
				const page = await readCatalogFactNodes(tx, work, null, fact.id, after, 37);
				recovered.push(...page);
				const last = page.at(-1);
				if (page.length < 37 || !last) break;
				after = last.position;
			}
			assert.equal(recovered.length, nodes.length);
			assert.equal(recovered.filter(({ memberKey }) => memberKey === "key").length, 520);
			assert.equal(recovered.find(({ kind }) => kind === "number")?.numberValue, "1.5");
			await assert.rejects(
				tx.transaction((nested) =>
					appendCatalogFactNodes(nested, work, actor, sealed.revision, fact.id, lastPosition, [
						{ ...nodes[0], position: lastPosition + 1 },
					]),
				),
			);
			assertions += 4;
			await rejected(
				tx,
				(nested) =>
					nested.execute(
						sql`update public.publishing_fact_value_node set text_value = 'tampered' where owner_id = ${work.id}::uuid and fact_id = ${fact.id}::uuid and position = 2`,
					),
				"23514",
				"catalog_fact_value_immutable",
			);
			await rejected(
				tx,
				(nested) =>
					nested.execute(
						sql`delete from public.publishing_fact_value_node where owner_id = ${work.id}::uuid and fact_id = ${fact.id}::uuid and position = ${lastPosition}`,
					),
				"23514",
				"catalog_fact_value_immutable",
			);
			await rejected(
				tx,
				(nested) =>
					nested.execute(
						sql`update public.publishing_fact set sealed_at = null where owner_id = ${work.id}::uuid and id = ${fact.id}::uuid`,
					),
				"23514",
				"catalog_fact_value_immutable",
			);

			await rejected(
				tx,
				(nested) =>
					nested.insert(CatalogIdentityTables.entity).values({ id: universe.id, shape: "person" }),
				"23505",
			);
			await rejected(
				tx,
				(nested) =>
					nested.execute(
						sql`insert into public.unit(id, kind) values (${universe.id}::uuid, 'entity')`,
					),
				"23505",
			);
			await rejected(
				tx,
				(nested) =>
					nested.insert(CatalogFactTables.grouping.participant).values({
						ownerId: universe.id,
						relationId: membership.id,
						roleRevisionId: subject.revisionId,
						position: 100,
						entityId: work.id,
					}),
				"23503",
			);
			await rejected(
				tx,
				(nested) =>
					nested.insert(CatalogFactTables.grouping.participant).values({
						ownerId: universe.id,
						relationId: membership.id,
						roleRevisionId: subject.revisionId,
						position: 100,
						groupingId: universe.id,
						publishingId: work.id,
					}),
				"23514",
			);
			await rejected(
				tx,
				(nested) =>
					nested.insert(CatalogFactTables.grouping.participant).values({
						ownerId: franchise.id,
						relationId: membership.id,
						roleRevisionId: subject.revisionId,
						position: 100,
						groupingId: universe.id,
					}),
				"23503",
			);
			await rejected(
				tx,
				(nested) =>
					nested
						.insert(CatalogFactTables.grouping.relation)
						.values({ ownerId: universe.id, definitionRevisionId: subject.revisionId }),
				"23514",
			);
			await rejected(
				tx,
				(nested) =>
					nested
						.update(catalogDefinitionRevision)
						.set({ version: 2 })
						.where(eq(catalogDefinitionRevision.id, infobox.revisionId)),
				"23514",
			);

			const privateTarget = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person", visibility: "private", status: "published" },
				actor,
			);
			const privateLink = await createCatalogRelation(tx, universe, actor, universe.revision, {
				definitionRevisionId: about.revisionId,
				participants: [{ roleRevisionId: object.revisionId, target: privateTarget }],
			});
			universe.revision = privateLink.revision;
			assert.equal(
				(await findCatalogRelations(tx, universe, null, about.revisionId)).some(
					({ id }) => id === privateLink.id,
				),
				false,
			);
			await tx
				.update(CatalogIdentityTables.entity)
				.set({ createdByAuthUserId: null })
				.where(eq(CatalogIdentityTables.entity.id, privateTarget.id));
			assert.equal(
				(await findCatalogRelations(tx, universe, null, about.revisionId)).some(
					({ id }) => id === privateLink.id,
				),
				false,
			);
			assertions += 2;

			const [source] = await tx
				.insert(catalogSourceRecord)
				.values({ source: "acceptance", objectType: "subject", externalId: "1" })
				.returning();
			assert.ok(source);
			const [snapshot] = await tx
				.insert(catalogSourceSnapshot)
				.values({
					sourceRecordId: source.id,
					contentSha256: "0".repeat(64),
					contractSha256: "1".repeat(64),
					payloadRef: "fixture:catalog-native-acceptance",
				})
				.returning();
			assert.ok(snapshot);
			await rejected(
				tx,
				(nested) =>
					nested
						.update(catalogSourceSnapshot)
						.set({ contentSha256: "2".repeat(64) })
						.where(
							and(
								eq(catalogSourceSnapshot.sourceRecordId, source.id),
								eq(catalogSourceSnapshot.id, snapshot.id),
							),
						),
				"23514",
				"catalog_source_snapshot_immutable",
			);
			const [support] = await tx
				.insert(CatalogFactTables.publishing.support)
				.values({
					ownerId: work.id,
					sourceRecordId: source.id,
					snapshotId: snapshot.id,
					sourcePath: "/infobox",
					factId: fact.id,
				})
				.returning();
			assert.ok(support);
			await rejected(
				tx,
				(nested) =>
					nested.insert(CatalogFactTables.publishing.support).values({
						ownerId: commentary.id,
						sourceRecordId: source.id,
						snapshotId: snapshot.id,
						sourcePath: "/infobox",
						factId: fact.id,
					}),
				"23503",
			);
			const stable = await resolveCatalogIdentity(tx, universe.id, actor);
			await assert.rejects(
				tx.transaction((nested) =>
					addCatalogName(nested, universe, actor, stable.revision - 1, {
						kind: "alias",
						languageTag: "en",
						value: "stale edit",
					}),
				),
			);
			assert.equal(
				(await resolveCatalogIdentity(tx, universe.id, actor)).revision,
				stable.revision,
			);
			assertions += 2;
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}

	const left = await pool.connect();
	const right = await pool.connect();
	let concurrentId: string | undefined;
	try {
		concurrentId = z
			.uuid()
			.parse((await left.query<{ id: string }>("select uuidv7() as id")).rows[0]?.id);
		await left.query("begin");
		await right.query("begin");
		await left.query("insert into public.entity_identity(id, shape) values ($1, 'acceptance')", [
			concurrentId,
		]);
		assert.equal(
			(
				await right.query<{ available: boolean }>(
					"select pg_try_advisory_xact_lock(hashtextextended('catalog-identity:' || $1::text, 0)) as available",
					[concurrentId],
				)
			).rows[0]?.available,
			false,
		);
		const competing = right.query(
			"insert into public.grouping_identity(id, shape) values ($1, 'acceptance')",
			[concurrentId],
		);
		const rejection = assert.rejects(
			competing,
			(error: unknown) => postgresError(error)?.code === "23505",
		);
		await left.query("commit");
		await rejection;
		await right.query("rollback");
		assertions += 2;
	} finally {
		await left.query("rollback");
		await right.query("rollback");
		if (concurrentId)
			await left.query(
				"delete from public.entity_identity where id = $1 and shape = 'acceptance' and created_by_auth_user_id is null",
				[concurrentId],
			);
		left.release();
		right.release();
	}
	if (concurrentId) {
		assert.equal(
			(
				await database
					.select()
					.from(catalogUnitLocator)
					.where(eq(catalogUnitLocator.id, concurrentId))
			).length,
			0,
		);
		assert.equal(
			(
				await database
					.select()
					.from(CatalogIdentityTables.entity)
					.where(
						and(
							eq(CatalogIdentityTables.entity.id, concurrentId),
							eq(CatalogIdentityTables.entity.shape, "acceptance"),
						),
					)
			).length,
			0,
		);
		assertions += 2;
	}
	console.info(
		`Passed ${assertions} native catalog acceptance assertions; rolled back fixture data and removed the exact private concurrency fixture`,
	);
} finally {
	await pool.end();
}
