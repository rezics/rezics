import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { entityCatalogProfileRevision } from "../src/services/database/schema/catalog-entity";
import {
	referenceArea,
	referenceCatalogProfileRevision,
} from "../src/services/database/schema/catalog-reference";
import { referenceIdentity } from "../src/services/database/schema/catalog-identity";
import { groupingOrderEntry } from "../src/services/database/schema/catalog-grouping";
import { transitionCatalogSemanticState } from "../src/services/catalog/semantic-history";
import {
	createEntity,
	initializeEntityProfile,
	readEntityProfile,
	readEntityProfileHistory,
	resolveEntityShape,
	restoreEntityProfile,
} from "../src/services/catalog/entities";
import {
	createReference,
	initializeReferenceProfile,
	readReferenceProfile,
	readReferenceProfileHistory,
	appendAreaCodes,
	readAreaCodes,
	restoreReferenceProfile,
} from "../src/services/catalog/references";
import {
	createGrouping,
	createGroupingOrderProfile,
	orderGroupingRelation,
	readGroupingOrder,
	readGroupingClasses,
	readGroupingHistory,
	removeGroupingOrderEntry,
	restoreGroupingCommand,
} from "../src/services/catalog/grouping";
import {
	createCatalogRelation,
	ensureCatalogDefinition,
	loadCatalogIdentity,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Supporting catalog acceptance requires an isolated rezics_atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 15000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback supporting catalog fixture");
let checks = 0;
const name = (value: string) => ({ languageTag: "en", value });
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Supporting catalog fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(account);
			const actor = account.id;
			const area = await createReference(tx, actor, {
				name: name("Historical region"),
				profile: { shape: "area", begin: { year: 1800, month: null, day: null }, ended: true },
			});
			const place = await createReference(tx, actor, {
				name: name("Venue"),
				profile: {
					shape: "place",
					areaId: area.id,
					latitude: 0,
					longitude: 0,
					begin: { year: 1900, month: null, day: null },
				},
			});
			const event = await createReference(tx, actor, {
				name: name("Performance"),
				profile: {
					shape: "event",
					placeId: place.id,
					begin: { year: 2024, month: 2, day: 29 },
					localTime: "19:30",
					cancelled: false,
				},
			});
			const instrument = await createReference(tx, actor, {
				name: name("Instrument"),
				profile: { shape: "instrument" },
			});
			const concept = await createReference(tx, actor, {
				name: name("Genre concept"),
				profile: { shape: "concept" },
			});
			const resource = await createReference(tx, actor, {
				name: name("Catalog resource"),
				profile: { shape: "web_resource", url: "https://example.invalid/resource" },
			});
			for (const ref of [area, place, event, instrument, concept, resource])
				assert.equal(
					(await readReferenceProfile(tx, ref, actor)).profile.shape,
					(await loadCatalogIdentity(tx, ref, actor, false)).shape,
				);
			checks += 6;
			const person = await createEntity(tx, actor, {
				shape: "person",
				name: name("Same name"),
				profile: { areaId: area.id, begin: { year: 1980, month: null, day: null } },
			});
			const character = await createEntity(tx, actor, {
				shape: "character",
				name: name("Same name"),
			});
			assert.notEqual(person.id, character.id);
			checks++;
			for (const shape of ["organization", "collective", "label", "service_actor"] as const) {
				const ref = await createEntity(tx, actor, { shape, name: name(shape) });
				assert.equal((await readEntityProfile(tx, ref, actor)).shape, shape);
				checks++;
			}
			const unknown = await createEntity(tx, actor, {
				shape: "unresolved",
				name: name("Unresolved producer"),
			});
			const resolved = await resolveEntityShape(
				tx,
				unknown,
				actor,
				unknown.revision,
				"organization",
			);
			assert.equal((await readEntityProfile(tx, unknown, actor)).shape, "organization");
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					resolveEntityShape(nested, unknown, actor, resolved.revision, "person"),
				),
			);
			checks++;
			const first = (await readEntityProfileHistory(tx, person, actor))[0];
			assert.ok(first);
			const changed = await initializeEntityProfile(tx, person, actor, person.revision, {
				ended: true,
			});
			const restored = await restoreEntityProfile(
				tx,
				person,
				actor,
				changed.revision,
				first.revision,
			);
			assert.equal((await readEntityProfile(tx, person, actor)).profile.begin?.year, 1980);
			assert.ok(restored.revision > changed.revision);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					initializeEntityProfile(nested, person, actor, person.revision, {}),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) => readEntityProfileHistory(nested, person, null)),
			);
			checks++;
			const history = await readReferenceProfileHistory(tx, place, actor);
			assert.ok(history[0]);
			const editedPlace = await initializeReferenceProfile(tx, place, actor, place.revision, {
				shape: "place",
				latitude: 12,
				longitude: 34,
			});
			await restoreReferenceProfile(tx, place, actor, editedPlace.revision, history[0].revision);
			assert.equal((await readReferenceProfile(tx, place, actor)).profile.shape, "place");
			checks++;
			const codes = await appendAreaCodes(tx, area, actor, area.revision, [
				{ namespace: "iso-3166-1", code: "AA" },
				{ namespace: "historical", code: "OLD" },
			]);
			const firstCode = await readAreaCodes(tx, area, actor, { limit: 1 });
			assert.ok(firstCode[0]);
			assert.equal((await readAreaCodes(tx, area, actor, { after: firstCode[0] })).length, 1);
			assert.ok(codes.revision > area.revision);
			checks++;
			const cls = await ensureCatalogDefinition(tx, {
				namespace: "supporting.fixture",
				key: "series",
				kind: "class",
				valueKind: null,
			});
			const wrong = await ensureCatalogDefinition(tx, {
				namespace: "supporting.fixture",
				key: "text",
				kind: "property",
				valueKind: "string",
			});
			await assert.rejects(
				tx.transaction((nested) =>
					initializeEntityProfile(nested, person, actor, restored.revision, {
						typeRevisionId: wrong.revisionId,
					}),
				),
			);
			checks++;
			const grouping = await createGrouping(tx, actor, {
				name: name("Source-free series"),
				classes: [cls.revisionId],
			});
			assert.equal(
				(await readGroupingClasses(tx, grouping, actor))[0]?.classRevisionId,
				cls.revisionId,
			);
			checks++;
			const role = await ensureCatalogDefinition(tx, {
				namespace: "supporting.fixture",
				key: "member",
				kind: "role",
				valueKind: null,
				constraints: { targets: [{ owner: "entity", shapes: ["person"] }] },
			});
			const predicate = await ensureCatalogDefinition(tx, {
				namespace: "supporting.fixture",
				key: "membership",
				kind: "predicate",
				valueKind: null,
				constraints: {
					targets: [{ owner: "grouping", shapes: ["grouping"] }],
					roles: [
						{
							roleRevisionId: role.revisionId,
							min: 1,
							max: 1,
							targets: [{ owner: "entity", shapes: ["person"] }],
						},
					],
				},
			});
			const relation = await createCatalogRelation(tx, grouping, actor, grouping.revision, {
				definitionRevisionId: predicate.revisionId,
				participants: [{ roleRevisionId: role.revisionId, target: person }],
			});
			const order = await createGroupingOrderProfile(
				tx,
				grouping,
				actor,
				relation.revision,
				"publication",
			);
			const ordered = await orderGroupingRelation(tx, grouping, actor, order.revision, {
				profileId: order.id,
				relationId: relation.id,
				position: "a0",
				sourcePosition: "1.5",
			});
			assert.equal(
				(await readGroupingOrder(tx, grouping, actor, order.id)).items[0]?.sourcePosition,
				"1.5",
			);
			checks++;
			const removed = await removeGroupingOrderEntry(tx, grouping, actor, ordered.revision, {
				profileId: order.id,
				relationId: relation.id,
			});
			assert.equal((await readGroupingOrder(tx, grouping, actor, order.id)).items.length, 0);
			const restoredOrder = await restoreGroupingCommand(
				tx,
				grouping,
				actor,
				removed.revision,
				ordered.revision,
			);
			assert.equal((await readGroupingOrder(tx, grouping, actor, order.id)).items.length, 1);
			checks++;
			const entries = await readGroupingHistory(tx, grouping, actor, { limit: 2 });
			assert.equal(entries.length, 2);
			checks++;
			const withdrawn = await transitionCatalogSemanticState(
				tx,
				grouping,
				actor,
				restoredOrder.revision,
				relation.semanticId,
				relation.headVersion,
				"withdrawn",
			);
			assert.equal((await readGroupingOrder(tx, grouping, actor, order.id)).items.length, 0);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					orderGroupingRelation(nested, grouping, actor, withdrawn.revision, {
						profileId: order.id,
						relationId: relation.id,
						position: "a1",
					}),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.delete(entityCatalogProfileRevision)
						.where(eq(entityCatalogProfileRevision.ownerId, person.id)),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(referenceCatalogProfileRevision)
						.set({ snapshot: {} })
						.where(eq(referenceCatalogProfileRevision.ownerId, area.id)),
				),
			);
			checks++;
			// Skewed structural fixture verifies selective pages with realistic competing keys, not a whole-owner load.
			const ids = Array.from({ length: 8192 }, () => crypto.randomUUID());
			for (let offset = 0; offset < ids.length; offset += 256) {
				await tx
					.insert(referenceIdentity)
					.values(
						ids
							.slice(offset, offset + 256)
							.map((id) => ({ id, shape: "area", createdByAuthUserId: actor })),
					);
				await tx
					.insert(referenceArea)
					.values(ids.slice(offset, offset + 256).map((id) => ({ id })));
			}
			await tx.execute(sql`ANALYZE public.reference_area`);
			const plans = await tx.execute(
				sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM public.reference_area WHERE id=${area.id}::uuid`,
			);
			assert.match(JSON.stringify(plans.rows), /Index Scan/);
			checks++;
			const pageSql = tx
				.select()
				.from(groupingOrderEntry)
				.where(
					and(
						eq(groupingOrderEntry.ownerId, grouping.id),
						eq(groupingOrderEntry.profileId, order.id),
					),
				)
				.orderBy(groupingOrderEntry.position, groupingOrderEntry.relationId)
				.limit(50)
				.toSQL();
			assert.match(pageSql.sql, /limit/);
			checks++;
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(JSON.stringify({ checks, rolledBack: true }));
} finally {
	await pool.end();
}
