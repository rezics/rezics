import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"./libraries/observability/vitest.config.ts",
			"./libraries/i18n/vitest.config.ts",
			"./services/main/vitest.config.ts",
			"./apps/web/vitest.config.ts",
			"./apps/about/vitest.config.ts",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
});
