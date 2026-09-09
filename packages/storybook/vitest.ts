import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { coverageConfigDefaults, defineConfig } from "vitest/config";
import type { UserConfig } from "vite";

/** Native browser project shared by independent CSS/provider runtimes. */
export function createStorybookVitestConfig({
	projectUrl,
	artifactDirectory,
	viteConfig: storybookViteConfig,
	script,
	defaultPort,
}: {
	projectUrl: URL;
	artifactDirectory: URL;
	viteConfig: UserConfig;
	script: string;
	defaultPort: number;
}) {
	const root = fileURLToPath(projectUrl);
	const configDir = fileURLToPath(new URL(".storybook", projectUrl)).replaceAll("\\", "/");
	const artifactRoot = fileURLToPath(artifactDirectory);
	return defineConfig({
		root,
		test: {
			attachmentsDir: `${artifactRoot}attachments`,
			projects: [
				{
					...storybookViteConfig,
					root,
					plugins: [
						...(storybookViteConfig.plugins ?? []),
						storybookTest({
							configDir,
							storybookScript: script,
							storybookUrl: process.env.STORYBOOK_URL ?? `http://127.0.0.1:${defaultPort}`,
						}),
					],
					test: {
						// Vitest filters inline projects before Storybook's name-override plugin runs.
						name: process.env.VITEST_STORYBOOK === "true" ? `storybook:${configDir}` : "storybook",
						setupFiles: [fileURLToPath(new URL("./setup.ts", import.meta.url))],
						testTimeout: 30_000,
						hookTimeout: 30_000,
						maxWorkers: 2,
						attachmentsDir: `${artifactRoot}attachments`,
						provide: {
							storybookScreenshotDirectory: `${artifactRoot}screenshots`,
							storybookCaptureScreenshots: process.env.STORYBOOK_CAPTURE === "true",
						},
						browser: {
							enabled: true,
							headless: true,
							ui: false,
							screenshotFailures: true,
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
}
