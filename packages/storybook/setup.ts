import { afterEach, inject } from "vitest";
import { page } from "vitest/browser";

declare module "vitest" {
	interface ProvidedContext {
		storybookScreenshotDirectory: string;
		storybookCaptureScreenshots: boolean;
	}
}

// Explicit capture uses the native runner; ordinary passing tests create no images.
afterEach(async ({ task }) => {
	if (!inject("storybookCaptureScreenshots")) return;
	const storyId = "storyId" in task.meta ? task.meta.storyId : undefined;
	if (typeof storyId !== "string") return;
	await document.fonts.ready;
	await Promise.all(
		Array.from(document.images, async (image) => {
			// CodeMirror's hidden, source-less widget buffers are caret sentinels, not assets.
			if (image.matches('.cm-widgetBuffer[aria-hidden="true"]:not([src]):not([srcset])')) return;
			if (image.complete) {
				if (!image.naturalWidth)
					throw new Error(`Story image failed: ${image.currentSrc || image.src}`);
				return;
			}
			await image.decode();
		}),
	);
	const testName = task.name.replace(/[^a-zA-Z0-9_-]+/g, "-");
	const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
	const name = `${encodeURIComponent(storyId)}--${document.documentElement.lang}--${theme}--${innerWidth}x${innerHeight}--${testName}`;
	await page.elementLocator(document.body).screenshot({
		path: `${inject("storybookScreenshotDirectory")}/${name}.png`,
		animations: "disabled",
	});
});
