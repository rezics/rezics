import { createStorybookVitestConfig } from "@rezics/storybook/vitest";
import viteConfig from "./.storybook/vite.config";

export default createStorybookVitestConfig({
	projectUrl: new URL("./", import.meta.url),
	artifactDirectory: new URL("../../.temp/storybook/rezics-text/", import.meta.url),
	viteConfig,
	script: "yarn storybook --ci",
	defaultPort: 6008,
});
