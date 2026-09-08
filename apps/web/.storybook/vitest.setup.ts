import { afterEach, expect, inject } from "vitest";
import { page } from "vitest/browser";

declare module "vitest" {
	interface ProvidedContext {
		storybookScreenshotDirectory: string;
		storybookVisualRegression: boolean;
	}
}

// Use the native runner's lifecycle and screenshot API, including successful stories.
afterEach(async ({ task }) => {
	const storyId = "storyId" in task.meta ? task.meta.storyId : undefined;
	if (typeof storyId !== "string") return;
	await document.fonts.ready;
	await Promise.all(
		Array.from(document.images, async (image) => {
			if (image.complete) {
				if (!image.naturalWidth)
					throw new Error(`Story image failed: ${image.currentSrc || image.src}`);
				return;
			}
			await image.decode();
		}),
	);
	const testName = task.name.replace(/[^a-zA-Z0-9_-]+/g, "-");
	const theme = document.documentElement.dataset.theme ?? "light";
	const name = `${encodeURIComponent(storyId)}--${document.documentElement.lang}--${theme}--${innerWidth}x${innerHeight}--${testName}`;
	await page.elementLocator(document.body).screenshot({
		path: `${inject("storybookScreenshotDirectory")}/${name}.png`,
		animations: "disabled",
	});
	if (inject("storybookVisualRegression")) {
		await expect.element(page.elementLocator(document.body)).toMatchScreenshot(name, {
			comparatorName: "pixelmatch",
			comparatorOptions: { threshold: 0.02 },
			screenshotOptions: { animations: "disabled" },
		});
	}
});
