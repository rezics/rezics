import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		name: "about",
		environment: "node",
		include: ["src/**/*.test.ts"],
		globals: false,
		restoreMocks: true,
		expect: { requireAssertions: true },
	},
});
