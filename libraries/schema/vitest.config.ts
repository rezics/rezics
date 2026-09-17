import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
	root: fileURLToPath(new URL("./", import.meta.url)),
	test: {
		name: "schema",
		environment: "node",
		include: ["src/**/*.test.ts"],
		testTimeout: 60_000,
		expect: { requireAssertions: true },
	},
});
