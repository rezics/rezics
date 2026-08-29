import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: [
			{
				find: /^@rezics\/editor\/(core|codemirror|portable-text|markdown)$/u,
				replacement: fileURLToPath(
					new URL("../../../../packages/editor/src/$1/index.ts", import.meta.url),
				),
			},
			{
				find: /^@rezics\/editor$/u,
				replacement: fileURLToPath(
					new URL("../../../../packages/editor/src/index.ts", import.meta.url),
				),
			},
		],
	},
	clearScreen: false,
	server: {
		host: "127.0.0.1",
		port: 1420,
		strictPort: true,
	},
	build: {
		target: "es2022",
		sourcemap: true,
	},
});
