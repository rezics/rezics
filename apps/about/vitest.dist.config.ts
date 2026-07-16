import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
	root: fileURLToPath(new URL("./", import.meta.url)),
	test: {
		name: "about-dist",
		environment: "node",
		include: ["test/**/*.test.ts"],
		globals: false,
		expect: { requireAssertions: true },
	},
});
