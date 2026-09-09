import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The component runtime must not load Vinext, Cloudflare, or the application's PWA.
export default defineConfig({
	plugins: [tailwindcss()],
	cacheDir: fileURLToPath(new URL("../node_modules/.vite-storybook", import.meta.url)),
	resolve: {
		dedupe: ["native-i18n"],
		alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
	},
	// Keep symbol-based i18n bindings and their consumers in one optimized module graph.
	optimizeDeps: {
		include: ["native-i18n", "native-i18n/react", "native-i18n/react/client", "nuqs"],
	},
	server: { fs: { allow: [fileURLToPath(new URL("../../../", import.meta.url))] } },
});
