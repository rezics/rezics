import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	plugins: [react()],
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	test: {
		name: "about",
		environment: "node",
		environmentOptions: { jsdom: { url: "https://about.rezics.test/" } },
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		globals: false,
		restoreMocks: true,
		expect: { requireAssertions: true },
	},
});
