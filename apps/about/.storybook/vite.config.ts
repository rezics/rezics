import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	cacheDir: fileURLToPath(new URL("../node_modules/.vite-storybook", import.meta.url)),
	resolve: { dedupe: ["react", "react-dom"] },
	server: { fs: { allow: [fileURLToPath(new URL("../../../", import.meta.url))] } },
});
