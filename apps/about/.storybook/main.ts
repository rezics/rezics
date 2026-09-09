import { fileURLToPath } from "node:url";
import { defineMain } from "@storybook/react-vite/node";
import { storybookAddons, storybookFeatures, storybookViteFinal } from "@rezics/storybook/config";

export default defineMain({
	framework: {
		name: "@storybook/react-vite",
		options: {
			builder: { viteConfigPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) },
		},
	},
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	staticDirs: ["../public"],
	addons: storybookAddons,
	features: storybookFeatures,
	viteFinal: storybookViteFinal,
});
