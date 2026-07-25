import { initializeObservability } from "@rezics/observability";

const observability = initializeObservability({
	service: {
		name: "rezics-database-seed",
		version: "0.1.0",
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

try {
	const [{ database }, { parseSeedRunOptions }, { databaseSeedService }] = await Promise.all([
		import("../src/services/database"),
		import("../src/services/seed/contracts"),
		import("../src/services/seed/service"),
	]);
	try {
		await databaseSeedService.run(parseSeedRunOptions(process.argv.slice(2)));
	} finally {
		await database.$client.end();
	}
} finally {
	await observability.shutdown();
}
