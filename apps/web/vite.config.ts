import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { pwaManifest } from "./pwa";

function resolveApiProxyTarget(value: string | undefined) {
	const target = new URL(value ?? "http://localhost:3001");
	if (target.protocol !== "http:" && target.protocol !== "https:")
		throw new Error("REZICS_API_ORIGIN must use HTTP or HTTPS");
	if (target.pathname !== "/" || target.search || target.hash)
		throw new Error("REZICS_API_ORIGIN must be an origin without a path, query, or fragment");
	return target.origin;
}

const apiProxyTarget = resolveApiProxyTarget(process.env.REZICS_API_ORIGIN);

const pwaPlugins = VitePWA({
	registerType: "prompt",
	outDir: "dist/client",
	includeAssets: ["icons/favicon.svg", "icons/apple-touch-icon.png"],
	manifest: pwaManifest,
	workbox: {
		cacheId: "rezics",
		clientsClaim: true,
		globPatterns: ["_next/static/**/*.{css,js,woff,woff2}", "offline.html"],
		inlineWorkboxRuntime: true,
		navigateFallback: null,
		navigationPreload: true,
		runtimeCaching: [
			{
				urlPattern: ({ request }) => request.mode === "navigate",
				handler: "NetworkOnly",
				options: {
					precacheFallback: { fallbackURL: "/offline.html" },
				},
			},
		],
	},
});

// RSC analysis must resolve the registration virtual module, while generated
// PWA artifacts belong only in vinext's publicly served client output.
for (const plugin of pwaPlugins) {
	if (plugin.name === "vite-plugin-pwa:build") {
		plugin.applyToEnvironment = ({ name }) => name === "client";
	}
}

export default defineConfig({
	plugins: [vinext({}), ...pwaPlugins, tailwindcss()],
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: "portable-text-editor",
							test: /node_modules\/@portabletext\/editor/,
							maxSize: 350_000,
							includeDependenciesRecursively: false,
						},
					],
				},
			},
		},
	},
	server: {
		strictPort: true,
		proxy: {
			"/api": apiProxyTarget,
			"/image-assets": apiProxyTarget,
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./", import.meta.url)),
		},
	},
});
