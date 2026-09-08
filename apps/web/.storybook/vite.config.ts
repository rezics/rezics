import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The component runtime must not load Vinext, Cloudflare, or the application's PWA.
export default defineConfig({
	plugins: [tailwindcss()],
	cacheDir: fileURLToPath(new URL("../node_modules/.vite-storybook", import.meta.url)),
	resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
	server: { fs: { allow: [fileURLToPath(new URL("../../../", import.meta.url))] } },
});
