import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
} from "../src/services/database/schema/catalog-source";
import {
	addCatalogName,
	bindCatalogNameSourceOccurrence,
	readCatalogNameHistory,
	resolveCatalogNameSourceBinding,
	reviseCatalogName,
} from "../src/services/catalog/names";
import {
	addCatalogIdentifier,
	findCatalogIdentifierClaims,
	readCatalogIdentifierHistory,
	reviseCatalogIdentifier,
} from "../src/services/catalog/identifiers";
import {
	addCatalogNameAuthority,
	listCatalogNameAuthority,
	readCatalogNameAuthorityHistory,
	reviseCatalogNameAuthority,
} from "../src/services/catalog/authority";
import {
	CatalogAccessDenied,
	CatalogRevisionConflict,
	createCatalogIdentity,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(target.pathname)
)
	throw new Error("Named-form acceptance requires an isolated rezics_atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	database = drizzle({ client: pool });
const rollback = new Error("rollback named-form acceptance");
let checks = 0;
async function rejects(
	tx: DatabaseTransaction,
	run: (nested: DatabaseTransaction) => Promise<unknown>,
) {
	await assert.rejects(tx.transaction(run));
	checks++;
}
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({ name: "Name acceptance", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			const [other] = await tx
				.insert(users)
				.values({ name: "Other actor", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(actor && other);
			const identity = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person" },
				actor.id,
			);
			const second = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person" },
				actor.id,
			);
			const tables = CatalogNameTables.entity;
			const input = {
				value: "原名",
				kind: "alias",
				languageTag: "zh",
				translationMethod: "machine" as const,
			};
			const name = await addCatalogName(tx, identity, actor.id, identity.revision, input);
			const alias = await addCatalogName(tx, identity, actor.id, name.revision, {
				...input,
				value: "另一名稱",
				languageTag: "zh-Hant",
			});
			assert.notEqual(name.id, alias.id);
			checks++;
			assert.equal((await readCatalogNameHistory(tx, identity, actor.id, name.id)).length, 1);
			checks++;
			await assert.rejects(
				reviseCatalogName(tx, identity, other.id, name.id, 1, input),
				CatalogAccessDenied,
			);
			checks++;
			await reviseCatalogName(tx, identity, actor.id, name.id, 1, { ...input, value: "訂正名稱" });
			await assert.rejects(
				reviseCatalogName(tx, identity, actor.id, name.id, 1, input),
				CatalogRevisionConflict,
			);
			checks++;
			await reviseCatalogName(tx, identity, actor.id, name.id, 2, { ...input, state: "withdrawn" });
			await reviseCatalogName(tx, identity, actor.id, name.id, 3, input);
			const history = await readCatalogNameHistory(tx, identity, actor.id, name.id);
			assert.deepEqual(
				history.map((row) => row.state),
				["active", "active", "withdrawn", "active"],
			);
			checks++;
			assert.deepEqual(
				(await readCatalogNameHistory(tx, identity, actor.id, name.id, 2, 1)).map(
					(row) => row.revision,
				),
				[3],
			);
			checks++;
			await rejects(tx, (nested) =>
				nested
					.update(tables.nameRevision)
					.set({ value: "forged" })
					.where(
						and(eq(tables.nameRevision.ownerId, identity.id), eq(tables.nameRevision.id, name.id)),
					),
			);
			await rejects(tx, (nested) => nested.delete(tables.name).where(eq(tables.name.id, name.id)));
			await rejects(tx, (nested) =>
				nested.update(tables.name).set({ value: "no revision" }).where(eq(tables.name.id, name.id)),
			);
			await rejects(tx, (nested) =>
				nested.insert(tables.nameRevision).values({ ...history[0]!, revision: 99 }),
			);
			const identifier = await addCatalogIdentifier(tx, identity, actor.id, alias.revision, {
				namespace: "isrc",
				value: "GB-AHT-16-00302",
			});
			await addCatalogIdentifier(tx, second, actor.id, second.revision, {
				namespace: "isrc",
				value: "GBAHT1600302",
			});
			assert.equal(
				(
					await findCatalogIdentifierClaims(tx, "entity", actor.id, {
						namespace: "isrc",
						value: "GBAHT1600302",
					})
				).length,
				2,
			);
			checks++;
			await reviseCatalogIdentifier(tx, identity, actor.id, identifier.id, 1, {
				namespace: "isrc",
				value: "GBAHT1600302",
				state: "withdrawn",
			});
			assert.equal(
				(
					await findCatalogIdentifierClaims(tx, "entity", actor.id, {
						namespace: "isrc",
						value: "GBAHT1600302",
					})
				).length,
				1,
			);
			checks++;
			await reviseCatalogIdentifier(tx, identity, actor.id, identifier.id, 2, {
				namespace: "isrc",
				value: "GBAHT1600302",
			});
			assert.equal(
				(await readCatalogIdentifierHistory(tx, identity, actor.id, identifier.id)).length,
				3,
			);
			checks++;
			const [record] = await tx
				.insert(catalogSourceRecord)
				.values({
					source: "name-acceptance",
					objectType: "person",
					externalId: crypto.randomUUID(),
				})
				.returning();
			assert.ok(record);
			const [snapshot] = await tx
				.insert(catalogSourceSnapshot)
				.values({
					sourceRecordId: record.id,
					contentSha256: "a".repeat(64),
					contractSha256: "b".repeat(64),
					payloadRef: "fixture:name-acceptance",
				})
				.returning();
			assert.ok(snapshot);
			const source = {
				sourceRecordId: record.id,
				snapshotId: snapshot.id,
				sourcePath: "/aliases/0",
				namespace: "staff.alias",
				localKey: "123",
				nameId: name.id,
				nameRevision: 1,
			};
			await bindCatalogNameSourceOccurrence(tx, identity, actor.id, source);
			await bindCatalogNameSourceOccurrence(tx, identity, actor.id, source);
			assert.deepEqual(await resolveCatalogNameSourceBinding(tx, identity, actor.id, {sourceRecordId:source.sourceRecordId, namespace:source.namespace, localKey:source.localKey}), {
				nameId: name.id,
				nameRevision: 4,
			});
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					bindCatalogNameSourceOccurrence(nested, identity, actor.id, {
						...source,
						nameId: alias.id,
					}),
				),
				CatalogRevisionConflict,
			);
			checks++;
			const evidence = {
				sourceRecordId: record.id,
				snapshotId: snapshot.id,
				sourcePath: "/aliases/0/official",
			};
			const claim = {
				nameId: name.id,
				nameRevision: 1,
				claim: "official" as const,
				reviewState: "source_claim" as const,
				authorizerEntityId: null,
				role: "publisher",
				territory: null,
				channel: null,
				context: null,
				validFrom: null,
				validUntil: null,
				evidence,
				reviewEvidence: null,
				state: "active" as const,
			};
			const authority = await addCatalogNameAuthority(tx, identity, actor.id, claim);
			assert.equal((await listCatalogNameAuthority(tx, identity, actor.id, name.id, 4)).length, 0);
			checks++;
			await reviseCatalogNameAuthority(tx, identity, actor.id, authority.id, 1, {
				...claim,
				state: "withdrawn",
			});
			assert.equal(
				(await readCatalogNameAuthorityHistory(tx, identity, actor.id, authority.id)).length,
				2,
			);
			checks++;
			const foreignAuthorizer = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "person" },
				other.id,
			);
			await assert.rejects(
				addCatalogNameAuthority(tx, identity, actor.id, {
					...claim,
					authorizerEntityId: foreignAuthorizer.id,
					reviewState: "verified",
					reviewEvidence: evidence,
				}),
				CatalogAccessDenied,
			);
			checks++;
			await tx.execute(sql`set constraints all immediate`);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Passed ${checks} named-form, identifier and authority assertions; all fixture data rolled back`,
	);
} finally {
	await pool.end();
}
