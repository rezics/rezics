import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	cacheDir: fileURLToPath(new URL("../node_modules/.vite-storybook", import.meta.url)),
	resolve: {
		dedupe: ["react", "react-dom"],
		alias: [
			{
				find: /^@rezics\/editor\/(core|codemirror|portable-text|markdown)$/u,
				replacement: fileURLToPath(
					new URL("../../../packages/editor/src/$1/index.ts", import.meta.url),
				),
			},
			{
				find: /^@rezics\/editor$/u,
				replacement: fileURLToPath(
					new URL("../../../packages/editor/src/index.ts", import.meta.url),
				),
			},
		],
	},
	server: { fs: { allow: [fileURLToPath(new URL("../../../", import.meta.url))] } },
});
