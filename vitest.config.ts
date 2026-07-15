import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
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
