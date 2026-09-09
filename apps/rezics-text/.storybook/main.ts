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
	stories: ["../packages/app/src/**/*.stories.@(ts|tsx)"],

	addons: storybookAddons,
	features: storybookFeatures,
	viteFinal: storybookViteFinal,
});
