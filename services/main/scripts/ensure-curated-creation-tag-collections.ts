import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({
	path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
	quiet: true,
});

const [
	{ eq, sql },
	{ PlatformInstallationLockName, describePlatformCoreState, inspectPlatformCore },
	{ ensureCuratedCreationTagCollections },
	{ OfficialProfileIds },
	{ env },
	{ database },
	{ profile },
] = await Promise.all([
	import("drizzle-orm"),
	import("../src/services/bootstrap/core"),
	import("../src/services/bootstrap/service"),
	import("../src/services/bootstrap/data"),
	import("../src/services/config"),
	import("../src/services/database"),
	import("../src/services/database/schema"),
]);

const LocalDatabaseHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function assertCommandConfirmed(args: readonly string[]): void {
	if (args.length !== 1 || args[0] !== "--yes")
		throw new Error("Usage: ensure-curated-creation-tag-collections.ts --yes");
}

function assertLocalDatabase(): void {
	const hostname = new URL(env.DATABASE_URL).hostname;
	if (!LocalDatabaseHosts.has(hostname))
		throw new Error(
			`Curated Collection backfill is local-only; refusing database host ${hostname}`,
		);
}

try {
	assertCommandConfirmed(process.argv.slice(2));
	assertLocalDatabase();
	await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${PlatformInstallationLockName}, 0))`,
		);
		const [editorialProfile] = await tx
			.select({ id: profile.id })
			.from(profile)
			.where(eq(profile.id, OfficialProfileIds.editorial))
			.limit(1);
		if (!editorialProfile)
			throw new Error(
				"Curated Collection backfill requires an existing platform installation; run local setup first",
			);

		await ensureCuratedCreationTagCollections(tx);
		const platformCore = await inspectPlatformCore(tx);
		if (platformCore.status !== "ready")
			throw new Error(
				`Platform core verification failed: ${describePlatformCoreState(platformCore)}`,
			);
	});
	console.info("Curated creation Tag Collections are ready.");
} finally {
	await database.$client.end();
}
