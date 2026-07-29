import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

import { productMetadataPlugin } from "./src/content/productMetadataPlugin";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineProject({
	root,
	plugins: [productMetadataPlugin(), mdx(), react()],
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
