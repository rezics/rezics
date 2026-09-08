import { fileURLToPath } from "node:url";
import { defineMain } from "@storybook/nextjs-vite/node";

export default defineMain({
	framework: {
		name: "@storybook/nextjs-vite",
		options: {
			builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) },
		},
	},
	stories: [
		"../features/**/*.stories.@(ts|tsx)",
		"../../../libraries/ui/stories/**/*.stories.@(ts|tsx)",
		"./*.mdx",
	],
	staticDirs: ["../public", "./public"],
	addons: [
		"@storybook/addon-docs",
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"@storybook/addon-mcp",
		"msw-storybook-addon",
	],
	features: {
		componentsManifest: true,
		changeDetection: true,
		experimentalDocgenServer: true,
		experimentalReview: true,
		experimentalTestSyntax: true,
	},
});
