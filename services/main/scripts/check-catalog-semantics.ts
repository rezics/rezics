import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import {
	createCatalogIdentity,
	ensureCatalogDefinition,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
	createCatalogRelation,
	findCatalogRelations,
	pageCatalogRelations,
	readCatalogFactNodes,
} from "../src/services/catalog/storage";
import {
	listCatalogFacts,
	pageCatalogFacts,
	listCatalogSemanticHistory,
	restoreCatalogSemanticRevision,
	transitionCatalogSemanticState,
} from "../src/services/catalog/semantic-history";
import { catalogValueNodes } from "../src/services/catalog/value-nodes";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("An explicit disposable migration fixture is required");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
	throw new Error("Semantic fixtures require a loopback database");
const pool = new Pool({ connectionString, max: 2, statement_timeout: 10000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback semantic fixtures");
let checks = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [user] = await tx
				.insert(users)
				.values({ name: "Semantic fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(user);
			const actor = user.id;
			const identity = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person", status: "published", visibility: "public" },
				actor,
			);
			let revision = identity.revision;
			const property = await ensureCatalogDefinition(tx, {
				namespace: `fixture.${crypto.randomUUID()}`,
				key: "height",
				kind: "property",
				valueKind: "number",
				constraints: { minimum: 0, maximum: 400, unit: "cm" },
			});
			const draft = await beginCatalogFact(tx, identity, actor, revision, property.revisionId);
			revision = draft.revision;
			assert.equal((await listCatalogFacts(tx, identity, null)).length, 0);
			checks++;
			await assert.rejects(
				tx.transaction(async (nested) =>
					appendCatalogFactNodes(nested, identity, actor, revision, draft.id, -1, [
						...catalogValueNodes(-1),
					]),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(CatalogFactTables.entity.valueNode).values({
						ownerId: identity.id,
						factId: draft.id,
						position: 0,
						parentPosition: null,
						parentKind: null,
						memberKey: null,
						kind: "number",
						numberValue: "-1",
						rulePosition: 0,
					}),
				),
			);
			checks++;
			const appended = await appendCatalogFactNodes(tx, identity, actor, revision, draft.id, -1, [
				...catalogValueNodes(170),
			]);
			revision = appended.revision;
			const first = await sealCatalogFact(tx, identity, actor, revision, draft.id, 0);
			revision = first.revision;
			assert.equal((await listCatalogFacts(tx, identity, null)).length, 1);
			checks++;
			const second = await beginCatalogFact(tx, identity, actor, revision, property.revisionId, {
				semanticId: first.semanticId,
				expectedHeadVersion: first.headVersion,
			});
			revision = second.revision;
			const added = await appendCatalogFactNodes(tx, identity, actor, revision, second.id, -1, [
				...catalogValueNodes(175),
			]);
			revision = added.revision;
			assert.equal((await listCatalogFacts(tx, identity, null))[0]?.id, draft.id);
			checks++;
			const sealed = await sealCatalogFact(tx, identity, actor, revision, second.id, 0);
			revision = sealed.revision;
			assert.equal((await listCatalogFacts(tx, identity, null))[0]?.id, second.id);
			checks++;
			await assert.rejects(readCatalogFactNodes(tx, identity, null, draft.id));
			checks++;
			assert.equal(
				(await readCatalogFactNodes(tx, identity, actor, draft.id))[0]?.numberValue,
				"170",
			);
			checks++;
			assert.equal(
				(await listCatalogSemanticHistory(tx, identity, actor, first.semanticId)).length,
				2,
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					restoreCatalogSemanticRevision(nested, identity, actor, revision, first.semanticId, 1, 1),
				),
			);
			checks++;
			const restored = await restoreCatalogSemanticRevision(
				tx,
				identity,
				actor,
				revision,
				first.semanticId,
				2,
				1,
			);
			revision = restored.revision;
			assert.equal((await listCatalogFacts(tx, identity, null))[0]?.id, draft.id);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(CatalogFactTables.entity.valueNode)
						.set({ numberValue: "180" })
						.where(
							and(
								eq(CatalogFactTables.entity.valueNode.ownerId, identity.id),
								eq(CatalogFactTables.entity.valueNode.factId, draft.id),
							),
						),
				),
			);
			checks++;
			const disputed = await transitionCatalogSemanticState(
				tx,
				identity,
				actor,
				revision,
				first.semanticId,
				3,
				"disputed",
			);
			revision = disputed.revision;
			assert.equal((await listCatalogFacts(tx, identity, null))[0]?.state, "disputed");
			checks++;
			const withdrawn = await transitionCatalogSemanticState(
				tx,
				identity,
				actor,
				revision,
				first.semanticId,
				4,
				"withdrawn",
			);
			revision = withdrawn.revision;
			assert.equal((await listCatalogFacts(tx, identity, null)).length, 0);
			checks++;
			const emptyPage = await pageCatalogFacts(tx, identity, null, { limit: 1 });
			assert.equal(emptyPage.items.length, 0);
			assert.ok(emptyPage.afterId);
			checks++;

			await assert.rejects(
				tx.transaction((nested) =>
					restoreCatalogSemanticRevision(nested, identity, actor, revision, first.semanticId, 5, 1),
				),
			);
			checks++;
			const role = await ensureCatalogDefinition(tx, {
				namespace: `fixture.${crypto.randomUUID()}`,
				key: "participant",
				kind: "role",
				valueKind: null,
			});
			const predicate = await ensureCatalogDefinition(tx, {
				namespace: `fixture.${crypto.randomUUID()}`,
				key: "credit",
				kind: "predicate",
				valueKind: null,
				constraints: {
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
			const relation = await createCatalogRelation(tx, identity, actor, revision, {
				definitionRevisionId: predicate.revisionId,
				participants: [{ roleRevisionId: role.revisionId, target: identity }],
				spoiler: 1,
			});
			revision = relation.revision;
			assert.equal(
				(await findCatalogRelations(tx, identity, null, predicate.revisionId)).length,
				0,
			);
			checks++;
			assert.equal(
				(
					await findCatalogRelations(tx, identity, null, predicate.revisionId, {
						maxSpoiler: 1,
						participants: [{ roleRevisionId: role.revisionId, target: identity }],
					})
				).length,
				1,
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					createCatalogRelation(nested, identity, actor, revision, {
						definitionRevisionId: predicate.revisionId,
						participants: [
							{ roleRevisionId: role.revisionId, target: identity },
							{ roleRevisionId: role.revisionId, target: identity },
						],
					}),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(CatalogFactTables.entity.participant).values({
						ownerId: identity.id,
						relationId: relation.id,
						roleRevisionId: role.revisionId,
						position: 1,
						entityId: identity.id,
					}),
				),
			);
			checks++;
			const hiddenPage = await pageCatalogRelations(tx, identity, null, { limit: 1 });
			assert.equal(hiddenPage.items.length, 0);
			assert.ok(hiddenPage.afterId);
			checks++;
			const shape = await ensureCatalogDefinition(tx, {
				namespace: `fixture.${crypto.randomUUID()}`,
				key: "score",
				kind: "property",
				valueKind: "object",
				constraints: {
					rules: [
						{ position: 0, parent: null, memberKey: null, kind: "object" },
						{ position: 1, parent: 0, memberKey: "score", kind: "number", minimum: 0, maximum: 1 },
					],
				},
			});
			const structured = await beginCatalogFact(tx, identity, actor, revision, shape.revisionId);
			revision = structured.revision;
			await assert.rejects(
				tx.transaction((nested) =>
					appendCatalogFactNodes(nested, identity, actor, revision, structured.id, -1, [
						...catalogValueNodes({ score: 2 }),
					]),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					appendCatalogFactNodes(nested, identity, actor, revision, structured.id, -1, [
						...catalogValueNodes({ unknown: 0.5 }),
					]),
				),
			);
			checks++;
			const structuredAppend = await appendCatalogFactNodes(
				tx,
				identity,
				actor,
				revision,
				structured.id,
				-1,
				[...catalogValueNodes({ score: 0.5 })],
			);
			revision = structuredAppend.revision;
			revision = (await sealCatalogFact(tx, identity, actor, revision, structured.id, 1)).revision;
			checks++;
			await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(`Verified ${checks} semantic assertions; all fixture rows rolled back.`);
} finally {
	await pool.end();
}
