import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entries = {
	index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
	core: fileURLToPath(new URL("./src/core/index.ts", import.meta.url)),
	codemirror: fileURLToPath(new URL("./src/codemirror/index.ts", import.meta.url)),
	"portable-text": fileURLToPath(new URL("./src/portable-text/index.ts", import.meta.url)),
	markdown: fileURLToPath(new URL("./src/markdown/index.ts", import.meta.url)),
};

const externalPackages = [
	"@codemirror/",
	"@portabletext/",
	"codemirror",
	"markdown-it",
	"mdast-util-",
	"react",
];

export default defineConfig({
	build: {
		lib: {
			entry: entries,
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: (id) => externalPackages.some((packageName) => id.startsWith(packageName)),
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "_chunks/[name]-[hash].js",
			},
		},
	},
});
