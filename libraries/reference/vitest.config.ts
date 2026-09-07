import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
	root: fileURLToPath(new URL("./", import.meta.url)),
	test: {
		name: "reference",
		environment: "node",
		include: ["src/**/*.test.ts"],
		expect: { requireAssertions: true },
	},
});
