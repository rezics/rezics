import { initializeObservability } from "@rezics/observability";

import { RezicsVersion } from "../src/version";

const observability = initializeObservability({
	service: {
		name: "rezics-light-novel-demo",
		version: RezicsVersion,
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

try {
	const [{ database }, { lightNovelDemoService }] = await Promise.all([
		import("../src/services/database"),
		import("../src/services/content-pack/light-novel-demo"),
	]);
	try {
		const result = await lightNovelDemoService.run();
		console.info("Local light-novel demo installed", result);
	} finally {
		await database.$client.end();
	}
} finally {
	await observability.shutdown();
}
