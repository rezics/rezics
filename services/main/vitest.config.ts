import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	test: {
		name: "main",
		environment: "node",
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
		setupFiles: ["./src/vitest.setup.ts"],
		globals: false,
		restoreMocks: true,
		expect: { requireAssertions: true },
	},
});
