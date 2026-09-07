import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseTransaction } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { distributionIdentity } from "../src/services/database/schema/catalog-identity";
import {
	distributionManifest,
	distributionMember,
	distributionPackage,
	distributionRevision,
} from "../src/services/database/schema/catalog-distribution";
import {
	createPublication,
	createMusicRelease,
	createVisualNovel,
} from "../src/services/catalog/domains";
import { CatalogAccessDenied, CatalogRevisionConflict } from "../src/services/catalog/storage";
import {
	appendDistributionMembers,
	beginDistributionManifest,
	createDistributionPackage,
	publishDistributionManifest,
	queryDistributionPackages,
	readDistributionHistory,
	readDistributionMembers,
	readDistributionPackage,
	restoreDistributionPackage,
} from "../src/services/catalog/distribution";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Distribution acceptance requires an isolated rezics_atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback distribution acceptance");
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
			const [account, stranger] = await tx
				.insert(users)
				.values([
					{ name: "Distribution acceptance", email: `${crypto.randomUUID()}@example.invalid` },
					{ name: "Unrelated actor", email: `${crypto.randomUUID()}@example.invalid` },
				])
				.returning({ id: users.id });
			assert.ok(account && stranger);
			const actor = account.id;
			const game = await createVisualNovel(tx, actor, {
				value: "Boxed visual novel",
				languageTag: "en",
			});
			const book = await createPublication(tx, actor, {
				name: { value: "Printed art book", languageTag: "en" },
			});
			const music = await createMusicRelease(tx, actor, {
				name: { value: "Physical soundtrack", languageTag: "en" },
			});
			const box = await createDistributionPackage(tx, actor);
			const occurrenceIds = Array.from({ length: 4 }, () => crypto.randomUUID());
			assert.ok(occurrenceIds[0] && occurrenceIds[1] && occurrenceIds[2] && occurrenceIds[3]);
			await appendDistributionMembers(tx, box.id, actor, box.manifestId, 0, [
				{
					occurrenceId: occurrenceIds[0],
					target: { kind: "software_content", id: game.id },
					originalNumber: "Game",
					quantity: 1,
				},
				{
					occurrenceId: occurrenceIds[1],
					target: { kind: "publication", id: book.id },
					originalNumber: "Art book",
					quantity: null,
				},
			]);
			await assert.rejects(
				appendDistributionMembers(tx, box.id, actor, box.manifestId, 0, [
					{
						occurrenceId: crypto.randomUUID(),
						target: { kind: "publication", id: book.id },
						originalNumber: null,
						quantity: 1,
					},
				]),
				CatalogRevisionConflict,
			);
			checks++;
			await appendDistributionMembers(tx, box.id, actor, box.manifestId, 2, [
				{
					occurrenceId: occurrenceIds[2],
					target: { kind: "music_release", id: music.id },
					originalNumber: "CD A",
					quantity: 1,
				},
				{
					occurrenceId: occurrenceIds[3],
					target: { kind: "music_release", id: music.id },
					originalNumber: "Bonus CD A",
					quantity: 2,
				},
			]);
			const first = await publishDistributionManifest(tx, box.id, actor, box.manifestId, 0, 4, {
				label: "Game, art book and soundtrack",
			});
			const page1 = await readDistributionMembers(tx, box.id, actor, first.revision, -1, 2);
			const page2 = await readDistributionMembers(tx, box.id, actor, first.revision, 1, 2);
			assert.equal(page1[1]?.quantity, null);
			assert.equal(page2[0]?.target.id, page2[1]?.target.id);
			assert.notEqual(page2[0]?.occurrenceId, page2[1]?.occurrenceId);
			assert.equal(page2[1]?.originalNumber, "Bonus CD A");
			checks += 4;
			await tx
				.update(distributionIdentity)
				.set({ visibility: "public", status: "published" })
				.where(eq(distributionIdentity.id, box.id));
			await assert.rejects(
				readDistributionMembers(tx, box.id, stranger.id, 1),
				CatalogAccessDenied,
			);
			await assert.rejects(beginDistributionManifest(tx, box.id, stranger.id), CatalogAccessDenied);
			checks += 2;
			const replacement = await beginDistributionManifest(tx, box.id, actor);
			await appendDistributionMembers(tx, box.id, actor, replacement.id, 0, [
				{
					occurrenceId: occurrenceIds[0],
					target: { kind: "software_content", id: game.id },
					originalNumber: "Game only",
					quantity: 1,
				},
			]);
			await publishDistributionManifest(tx, box.id, actor, replacement.id, 1, 1, {
				label: "Game-only package",
			});
			const absent = await queryDistributionPackages(tx, actor, {
				kind: "music_release",
				id: music.id,
			});
			assert.equal(absent.items.length, 0);
			checks++;
			await assert.rejects(
				restoreDistributionPackage(tx, box.id, actor, 1, 1),
				CatalogRevisionConflict,
			);
			checks++;
			await restoreDistributionPackage(tx, box.id, actor, 2, 1);
			assert.equal((await readDistributionPackage(tx, box.id, actor)).manifestId, box.manifestId);
			assert.equal((await readDistributionHistory(tx, box.id, actor)).length, 3);
			assert.equal((await readDistributionMembers(tx, box.id, actor, 3)).length, 4);
			assert.equal(
				(await queryDistributionPackages(tx, actor, { kind: "music_release", id: music.id }))
					.items[0]?.packageId,
				box.id,
			);
			checks += 4;
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(distributionMember)
						.set({ quantity: 5 })
						.where(eq(distributionMember.packageId, box.id)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested.delete(distributionMember).where(eq(distributionMember.packageId, box.id)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(distributionManifest)
						.set({ sealedAt: null })
						.where(eq(distributionManifest.id, box.manifestId)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(distributionRevision)
						.set({ label: "Rewritten" })
						.where(eq(distributionRevision.packageId, box.id)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(distributionPackage)
						.set({ currentRevision: 1 })
						.where(eq(distributionPackage.id, box.id)),
				"23514",
			);
			const draft = await beginDistributionManifest(tx, box.id, actor);
			const base = {
				packageId: box.id,
				manifestId: draft.id,
				occurrenceId: crypto.randomUUID(),
				position: 0,
			};
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(distributionMember)
						.values({ ...base, publicationId: book.id, musicReleaseId: music.id }),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) => nested.insert(distributionMember).values({ ...base, musicReleaseId: game.id }),
				"23503",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(distributionMember)
						.values({ ...base, publicationId: book.id, quantity: 0 }),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(distributionMember)
						.values({ ...base, publicationId: book.id, position: 1 }),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.update(distributionManifest)
						.set({ memberCount: 99 })
						.where(eq(distributionManifest.id, draft.id)),
				"23514",
			);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(distributionRevision)
						.values({ packageId: box.id, revision: 4, manifestId: draft.id }),
				"23514",
			);
			const other = await createDistributionPackage(tx, actor);
			await rejectsCode(
				tx,
				(nested) =>
					nested
						.insert(distributionMember)
						.values({ ...base, packageId: other.id, publicationId: book.id }),
				"23503",
			);
			await tx.execute(sql`set constraints all immediate`);
			const plan = await tx.execute(
				sql`explain (analyze, buffers, format json) select * from public.distribution_member where package_id = ${box.id}::uuid and manifest_id = ${box.manifestId}::uuid and position > 1 order by position limit 128`,
			);
			assert.ok(plan.rows.length);
			checks++;
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(
		JSON.stringify({
			checks,
			status: "passed",
			evidence: "transaction rollback, real PostgreSQL, bounded member EXPLAIN",
		}),
	);
} finally {
	await pool.end();
}
