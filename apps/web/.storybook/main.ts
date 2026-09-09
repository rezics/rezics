import { fileURLToPath } from "node:url";
import { defineMain } from "@storybook/nextjs-vite/node";
import { storybookAddons, storybookFeatures, storybookViteFinal } from "@rezics/storybook/config";

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
		"../../../packages/editor/stories/**/*.stories.@(ts|tsx)",
		"./*.mdx",
	],
	staticDirs: ["../public", "./public"],
	addons: [...storybookAddons, "msw-storybook-addon"],
	features: storybookFeatures,
	viteFinal: storybookViteFinal,
	refs: {
		...(process.env.STORYBOOK_TEXT_URL
			? { text: { title: "REZICS Text", url: process.env.STORYBOOK_TEXT_URL } }
			: {}),
		...(process.env.STORYBOOK_ABOUT_URL
			? { about: { title: "About", url: process.env.STORYBOOK_ABOUT_URL } }
			: {}),
	},
});
