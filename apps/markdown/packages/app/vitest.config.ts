import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@rezics\/editor\/markdown$/u,
				replacement: fileURLToPath(
					new URL("../../../../packages/editor/src/markdown/index.ts", import.meta.url),
				),
			},
		],
	},
	test: {
		environment: "node",
	},
});
