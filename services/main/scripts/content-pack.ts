import { initializeObservability } from "@rezics/observability";

import { RezicsVersion } from "../src/version";

const observability = initializeObservability({
	service: {
		name: "rezics-content-pack",
		version: RezicsVersion,
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

try {
	const [{ database }, { contentPackService }] = await Promise.all([
		import("../src/services/database"),
		import("../src/services/content-pack/service"),
	]);
	try {
		await contentPackService.run(process.argv.slice(2));
	} finally {
		await database.$client.end();
	}
} finally {
	await observability.shutdown();
}
