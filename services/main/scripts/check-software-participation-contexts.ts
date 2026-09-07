import { bindCatalogSourceIdentity } from "../src/services/catalog/source-bindings";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { registerCatalogSourceRecord } from "../src/services/catalog/source-observations";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import {
	softwareParticipationContext,
	softwareParticipationContextRevision,
	softwareParticipationSourceOccurrence,
} from "../src/services/database/schema/catalog-software";
import { catalogSourceSnapshot } from "../src/services/database/schema/catalog-source";
import { createVisualNovel } from "../src/services/catalog/domains";
import {
	createSoftwareParticipationContext,
	readSoftwareParticipationContext,
	readSoftwareParticipationContextHistory,
	restoreSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
} from "../src/services/catalog/software-contexts";
import {
	CatalogAccessDenied,
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
} from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(target.pathname)
)
	throw new Error("Participation acceptance requires an isolated rezics_atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback software participation acceptance");
let checks = 0;
function pgCode(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;
	if ("code" in error && typeof error.code === "string") return error.code;
	return "cause" in error ? pgCode(error.cause) : undefined;
}
async function rejectsCode(
	tx: DatabaseTransaction,
	run: (nested: DatabaseTransaction) => Promise<unknown>,
	code: string,
) {
	await assert.rejects(tx.transaction(run), (error: unknown) => pgCode(error) === code);
	checks++;
}
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Participation acceptance",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			const [otherAccount] = await tx
				.insert(users)
				.values({ name: "Other actor", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account && otherAccount);
			const content = await createVisualNovel(tx, account.id, {
				value: "Source-free software",
				languageTag: "en",
			});
			const other = await createVisualNovel(tx, account.id, {
				value: "Independent software",
				languageTag: "en",
			});
			const original = await createSoftwareParticipationContext(tx, content, account.id, {
				label: "Translation team",
				languageTag: "EN-us",
				state: "active",
			});
			assert.equal(original.languageTag, "en-US");
			assert.equal(
				(await readSoftwareParticipationContext(tx, content, account.id, original.contextId))
					.revision,
				1,
			);
			await assert.rejects(
				readSoftwareParticipationContext(tx, other, account.id, original.contextId),
				CatalogReferenceNotFound,
			);
			await assert.rejects(
				readSoftwareParticipationContext(tx, content, otherAccount.id, original.contextId),
				CatalogAccessDenied,
			);
			checks += 4;
			const changed = await reviseSoftwareParticipationContext(
				tx,
				content,
				account.id,
				original.contextId,
				1,
				{ label: "Revised participation", languageTag: "ja", state: "withdrawn" },
			);
			assert.equal(changed.revision, 2);
			await assert.rejects(
				reviseSoftwareParticipationContext(tx, content, account.id, original.contextId, 1, {
					label: "Stale writer",
					languageTag: null,
					state: "active",
				}),
				CatalogRevisionConflict,
			);
			const restored = await restoreSoftwareParticipationContext(
				tx,
				content,
				account.id,
				original.contextId,
				2,
				1,
			);
			assert.equal(restored.revision, 3);
			assert.equal(restored.label, original.label);
			assert.equal(restored.languageTag, original.languageTag);
			assert.equal(restored.state, "active");
			const page = await readSoftwareParticipationContextHistory(
				tx,
				content,
				account.id,
				original.contextId,
				{ afterRevision: 1, limit: 1 },
			);
			assert.deepEqual(
				page.map(({ revision }) => revision),
				[2],
			);
			const history = await readSoftwareParticipationContextHistory(
				tx,
				content,
				account.id,
				original.contextId,
			);
			assert.deepEqual(
				history.map(({ revision, state }) => [revision, state]),
				[
					[1, "active"],
					[2, "withdrawn"],
					[3, "active"],
				],
			);
			checks += 8;
			const revision = softwareParticipationContextRevision;
			const header = softwareParticipationContext;
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(revision)
						.set({ label: "Rewrite" })
						.where(
							and(eq(revision.contentId, content.id), eq(revision.contextId, original.contextId)),
						),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.delete(revision)
						.where(
							and(eq(revision.contentId, content.id), eq(revision.contextId, original.contextId)),
						),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(header)
						.set({ currentRevision: 1 })
						.where(and(eq(header.contentId, content.id), eq(header.id, original.contextId))),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(header)
						.set({ currentRevision: 4 })
						.where(and(eq(header.contentId, content.id), eq(header.id, original.contextId))),
				"23503",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested.insert(revision).values({
						contentId: other.id,
						contextId: original.contextId,
						revision: 1,
						label: null,
						languageTag: null,
						state: "active",
						createdByAuthUserId: account.id,
					}),
				"23503",
			);
			await rejectsCode(
				tx,
				async (nested) => {
					await nested.insert(header).values({ contentId: content.id });
					await nested.execute(sql`set constraints software_context_head_required immediate`);
				},
				"23514",
			);
			await rejectsCode(
				tx,
				async (nested) => {
					await nested.insert(revision).values({
						contentId: content.id,
						contextId: original.contextId,
						revision: 4,
						label: null,
						languageTag: null,
						state: "active",
						createdByAuthUserId: account.id,
					});
					await nested.execute(
						sql`set constraints software_context_revision_head_required immediate`,
					);
				},
				"23514",
			);
			const source = await registerCatalogSourceRecord(tx, {
				source: "participation-fixture",
				objectType: "vn",
				externalId: crypto.randomUUID(),
			});
			const otherSource = await registerCatalogSourceRecord(tx, {
				source: "participation-fixture",
				objectType: "vn",
				externalId: crypto.randomUUID(),
			});
			assert.ok(source && otherSource);
			const snapshots = await tx
				.insert(catalogSourceSnapshot)
				.values([
					{
						sourceRecordId: source.id,
						contentSha256: "a".repeat(64),
						contractSha256: "b".repeat(64),
						payloadRef: "fixture:first",
					},
					{
						sourceRecordId: source.id,
						contentSha256: "c".repeat(64),
						contractSha256: "b".repeat(64),
						payloadRef: "fixture:second",
					},
					{
						sourceRecordId: otherSource.id,
						contentSha256: "d".repeat(64),
						contractSha256: "b".repeat(64),
						payloadRef: "fixture:other",
					},
				])
				.returning();
			assert.equal(snapshots.length, 3);
			const sourceMappings = new Map<string, string>();
			for (const snapshot of snapshots) {
				if (sourceMappings.has(snapshot.sourceRecordId)) continue;
				const binding = await bindCatalogSourceIdentity(tx, account.id, {
					sourceRecordId: snapshot.sourceRecordId,
					snapshotId: snapshot.id,
					path: "/",
					reference: content,
					mappingVersion: "participation-fixture.vn.1",
				});
				sourceMappings.set(snapshot.sourceRecordId, binding.mappingKey);
			}
			const occurrence = softwareParticipationSourceOccurrence;
			for (const snapshot of snapshots) {
				const native = await createSoftwareParticipationContext(tx, content, account.id, {
					label: "Observed team",
					languageTag: "en",
					state: "active",
				});
				const mappingKey = sourceMappings.get(snapshot.sourceRecordId);
				assert.ok(mappingKey);
				await tx.insert(occurrence).values({
					mappingKey,
					correspondenceRevision: 1,
					sourceRecordId: snapshot.sourceRecordId,
					snapshotId: snapshot.id,
					namespace: "editions",
					localKey: "0",
					contentId: content.id,
					contextId: native.contextId,
					contextRevision: 1,
					sourcePointer: "/editions/0",
					sourceLabel: "Observed team",
					sourceLanguage: "en",
					sourceLanguageTag: "en",
					sourceClaimedOfficial: false,
				});
			}
			const mappings = await tx
				.select()
				.from(occurrence)
				.where(eq(occurrence.contentId, content.id));
			assert.equal(new Set(mappings.map(({ contextId }) => contextId)).size, 3);
			const observed = mappings[0];
			assert.ok(observed);
			await reviseSoftwareParticipationContext(tx, content, account.id, observed.contextId, 1, {
				label: "Locally edited team",
				languageTag: "fr",
				state: "withdrawn",
			});
			const [after] = await tx
				.select()
				.from(occurrence)
				.where(
					and(
						eq(occurrence.sourceRecordId, observed.sourceRecordId),
						eq(occurrence.snapshotId, observed.snapshotId),
						eq(occurrence.namespace, observed.namespace),
						eq(occurrence.localKey, observed.localKey),
					),
				);
			assert.deepEqual(after, observed);
			checks += 3;
			await rejectsCode(tx, (nested) => nested.insert(occurrence).values(observed), "23505");
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(occurrence)
						.values({ ...observed, localKey: "wrong-revision", contextRevision: 999 }),
				"23503",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(occurrence)
						.values({ ...observed, localKey: "wrong-owner", contentId: other.id }),
				"23503",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested.insert(occurrence).values({ ...observed, sourceRecordId: crypto.randomUUID() }),
				"23503",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(occurrence)
						.values({ ...observed, localKey: "incomplete-language", sourceLanguage: null }),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(occurrence)
						.set({ sourceClaimedOfficial: true })
						.where(eq(occurrence.contentId, content.id)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) => nested.delete(occurrence).where(eq(occurrence.contentId, content.id)),
				"23514",
			);
			await tx.execute(sql`set constraints all immediate`);
			const plan = await tx.execute(
				sql`explain (format json) select * from software_participation_context_revision where content_id = ${content.id}::uuid and context_id = ${original.contextId}::uuid and revision > 1 order by revision limit 100`,
			);
			console.info("Bounded history query plan:", JSON.stringify(plan.rows));
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		`Verified ${checks} software participation assertions: native create/edit/withdraw/restore, scoped current/history reads, stale revisions, immutable history and observations, committed heads, exact snapshot and owner constraints; all rows rolled back.`,
	);
} finally {
	await pool.end();
}
