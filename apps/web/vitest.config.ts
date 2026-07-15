import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	resolve: {
		alias: { "@": root },
	},
	test: {
		name: "web",
		environment: "node",
		include: ["**/*.test.{ts,tsx}"],
		exclude: ["**/{node_modules,.next,.vinext,dist}/**"],
		globals: false,
		restoreMocks: true,
		expect: { requireAssertions: true },
	},
});
