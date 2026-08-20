import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"./libraries/access/vitest.config.ts",
			"./libraries/avatar/vitest.config.ts",
			"./libraries/content-language/vitest.config.ts",
			"./libraries/portable-text/vitest.config.ts",
			"./libraries/observability/vitest.config.ts",
			"./libraries/license/vitest.config.ts",
			"./libraries/i18n/vitest.config.ts",
			"./libraries/fixture-data/vitest.config.ts",
			"./libraries/filter/vitest.config.ts",
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
