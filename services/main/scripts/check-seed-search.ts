import { initializeObservability } from "@rezics/observability";

const observability = initializeObservability({
	service: {
		name: "rezics-database-seed-search-check",
		version: "0.1.0",
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

try {
	const [{ database }, { verifySeedSearch }] = await Promise.all([
		import("../src/services/database"),
		import("../src/services/seed/verification"),
	]);
	try {
		await verifySeedSearch();
		console.info("Official Zone Seed Search contract is ready.");
	} finally {
		await database.$client.end();
	}
} finally {
	await observability.shutdown();
}
