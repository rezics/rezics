import { fileURLToPath, URL } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { pwaManifest } from "./pwa";
import { fontAwesomeWorkerVariables } from "./vite-worker-environment";

const developmentOptimizeDepsExclude = [
	"@tanstack/react-query",
	"@cloudflare/playwright",
	"opencc-js/cn2t",
	"opencc-js/t2cn",
] as const;

const applicationClientWarmupFiles = [
	"./lib/app-providers.tsx",
	"./features/application-shell/application-shell.tsx",
	"./features/explore/home.tsx",
	"./features/content-feed/data/api-feed-list.tsx",
] as const;

const applicationRscWarmupFiles = [
	"./app/layout.tsx",
	"./app/(app)/layout.tsx",
	"./app/(app)/page.tsx",
	"./i18n/translation-boundary.tsx",
] as const;

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

export default defineConfig(({ command }) => ({
	// Isolated smoke runs receive random Aspire proxy endpoints. Keep their
	// config-specific optimizer output from evicting the stable daily-dev cache.
	...(command === "serve" && process.env.REZICS_ASPIRE_MODE === "smoke"
		? { cacheDir: "node_modules/.vite-smoke" }
		: {}),
	plugins: [
		vinext({}),
		cloudflare({
			viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
			...(command === "serve"
				? {
						config: (workerConfig) => ({
							vars: {
								...workerConfig.vars,
								...fontAwesomeWorkerVariables(process.env),
							},
						}),
					}
				: {}),
		}),
		...pwaPlugins,
		tailwindcss(),
	],
	// RSC resolves React Query's "use client" modules by file path, so keep its
	// package entry and internal modules on the same unoptimized module graph.
	// This is intentionally unchanged for the production config boundary.
	optimizeDeps: {
		exclude: command === "serve" ? [...developmentOptimizeDepsExclude] : ["@tanstack/react-query"],
	},
	environments: {
		client: {
			// The following spread is serve-only. The extra exclusions are
			// single-file, pure-ESM dependencies reached by optional dynamic
			// imports, so eagerly copying their large source maps into every
			// environment adds work without reducing common-path requests.
			...(command === "serve"
				? {
						dev: { warmup: [...applicationClientWarmupFiles] },
						optimizeDeps: { exclude: [...developmentOptimizeDepsExclude] },
					}
				: {}),
			build: {
				rolldownOptions: {
					output: {
						// Preserve module initialization order across the intentionally non-recursive editor split.
						strictExecutionOrder: true,
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
		},
		...(command === "serve"
			? {
					rsc: {
						dev: { warmup: [...applicationRscWarmupFiles] },
						optimizeDeps: { exclude: [...developmentOptimizeDepsExclude] },
					},
					ssr: {
						dev: { warmup: [...applicationClientWarmupFiles] },
						optimizeDeps: { exclude: [...developmentOptimizeDepsExclude] },
					},
				}
			: {}),
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
}));
