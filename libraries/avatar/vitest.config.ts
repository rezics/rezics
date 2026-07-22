import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	test: {
		name: "avatar",
		environment: "node",
		include: ["src/**/*.test.ts"],
		globals: false,
		restoreMocks: true,
		expect: { requireAssertions: true },
	},
});
