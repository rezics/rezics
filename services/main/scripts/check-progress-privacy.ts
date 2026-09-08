import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname) ||
	url.port === "15432"
)
	throw new Error("Progress privacy checks require an isolated loopback Atlas database");

const { database } = await import("../src/services/database");
const { users, unitProgress } = await import("../src/services/database/schema");
const { createCatalogIdentity } = await import("../src/services/catalog/storage");
const { runWithNativeFixtureActor } = await import("./native-fixture-actor");
const { createProgressEntry, lockUnitProgress } = await import(
	"../src/services/api/progress/service"
);
const rollback = new Error("rollback disposable privacy fixture");
try {
	await database.transaction(async (tx) => {
		assert.equal(
			(await tx.execute<{ name: string }>(sql`select current_database() as name`)).rows[0]?.name,
			url.pathname.slice(1),
		);
		const [account] = await tx
			.insert(users)
			.values({ name: "Privacy fixture", email: `${crypto.randomUUID()}@example.invalid` })
			.returning();
		assert.ok(account);
		const target = await runWithNativeFixtureActor(tx, account.id, () =>
			createCatalogIdentity(tx, { owner: "publishing", shape: "work" }, account.id),
		);
		const key = and(eq(unitProgress.authUserId, account.id), eq(unitProgress.unitId, target.id));
		const visibility = async () =>
			(await tx.select({ visibility: unitProgress.visibility }).from(unitProgress).where(key))[0]
				?.visibility;
		await lockUnitProgress(tx, account.id, target.id);
		const write = () =>
			createProgressEntry(tx, account.id, target.id, {
				entryKind: "update",
				status: "active",
				progress: 0.2,
				occurredAt: new Date(),
				datePrecision: "instant",
				affectsCurrent: true,
			});
		await write();
		assert.equal(
			await visibility(),
			"private",
			"A new journal must not inherit the generic public default",
		);
		for (const shared of ["public", "unlisted"] as const) {
			await tx.update(unitProgress).set({ visibility: shared }).where(key);
			await write();
			assert.equal(
				await visibility(),
				shared,
				"Updating existing progress must retain its explicit disclosure choice",
			);
		}
		await tx.update(unitProgress).set({ deletedAt: new Date() }).where(key);
		await write();
		assert.equal(
			await visibility(),
			"private",
			"Recreating deleted progress must not silently restore public disclosure",
		);
		throw rollback;
	});
} catch (error) {
	if (error !== rollback) throw error;
	console.info(
		JSON.stringify({
			newProgressPrivate: true,
			explicitVisibilityPreserved: true,
			recreationPrivate: true,
			fixturesRolledBack: true,
		}),
	);
} finally {
	await database.$client.end();
}
