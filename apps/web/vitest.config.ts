import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { coverageConfigDefaults, defineConfig } from "vitest/config";
import storybookViteConfig from "./.storybook/vite.config";

const root = fileURLToPath(new URL("./", import.meta.url));
const configDir = fileURLToPath(new URL("./.storybook", import.meta.url)).replaceAll("\\", "/");
const artifactRoot = fileURLToPath(new URL("../../.temp/storybook/", import.meta.url));

export default defineConfig({
	root,
	test: {
		attachmentsDir: `${artifactRoot}attachments`,
		projects: [
			{
				...storybookViteConfig,
				root,
				plugins: [
					...(storybookViteConfig.plugins ?? []),
					storybookTest({ configDir, storybookScript: "yarn storybook --ci" }),
				],
				test: {
					// Vitest filters inline projects before Storybook's name-override plugin runs.
					name: process.env.VITEST_STORYBOOK === "true" ? `storybook:${configDir}` : "storybook",
					setupFiles: [".storybook/vitest.setup.ts"],
					testTimeout: 30_000,
					hookTimeout: 30_000,
					maxWorkers: 2,
					attachmentsDir: `${artifactRoot}attachments`,
					provide: {
						storybookScreenshotDirectory: `${artifactRoot}screenshots`,
						storybookVisualRegression: process.env.STORYBOOK_VISUAL_REGRESSION === "true",
					},
					browser: {
						enabled: true,
						headless: true,
						ui: false,
						provider: playwright({
							contextOptions: {
								// Fit the largest toolbar viewport without Vitest scaling its iframe.
								viewport: { width: 1280, height: 1024 },
								locale: "en-US",
								timezoneId: "Asia/Taipei",
								reducedMotion: "reduce",
								deviceScaleFactor: 1,
							},
						}),
						instances: [{ browser: "chromium" }],
						viewport: { width: 1280, height: 900 },
						screenshotDirectory: `${artifactRoot}failures`,
						expect: {
							toMatchScreenshot: {
								resolveScreenshotPath: ({ arg, browserName, platform, ext }) =>
									`${root}.storybook/baselines/${arg}-${browserName}-${platform}${ext}`,
								resolveDiffPath: ({ arg, browserName, platform, ext }) =>
									`${artifactRoot}diffs/${arg}-${browserName}-${platform}${ext}`,
							},
						},
						trace: { mode: "retain-on-failure", tracesDir: `${artifactRoot}traces` },
					},
				},
			},
		],
		coverage: {
			provider: "v8",
			allowExternal: true,
			exclude: [
				...coverageConfigDefaults.exclude,
				"**/*.stories.*",
				"**/*.fixture.*",
				"**/.storybook/**",
				"**/libraries/ui/stories/**",
			],
			reportsDirectory: `${artifactRoot}coverage`,
			reporter: ["text", "html"],
		},
	},
});
