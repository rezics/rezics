import { resolve } from "node:path";
import type { UserConfig } from "vite";

/** Shared official capabilities; each host owns its renderer, stories and providers. */
export const storybookFeatures = {
	componentsManifest: true,
	changeDetection: true,
	experimentalDocgenServer: true,
	experimentalReview: true,
	experimentalTestSyntax: true,
} as const;

export const storybookAddons = [
	"@storybook/addon-docs",
	"@storybook/addon-vitest",
	"@storybook/addon-a11y",
	"@storybook/addon-mcp",
];

/** Isolate the official agent runner from direct visual/coverage runs in the same host. */
export async function storybookViteFinal(config: UserConfig): Promise<UserConfig> {
	if (!process.env.VITEST && process.env.VITEST_STORYBOOK !== "true") return config;
	return {
		...config,
		cacheDir: resolve(
			config.root ?? process.cwd(),
			"node_modules/.cache/storybook",
			process.env.VITEST_STORYBOOK === "true" ? "agent-tests" : "direct-tests",
		),
	};
}
