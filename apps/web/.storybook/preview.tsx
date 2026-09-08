import { definePreview } from "@storybook/nextjs-vite";
import addonA11y from "@storybook/addon-a11y";
import { UiLocaleValues } from "@rezics/i18n";
import { FixtureContentLanguages } from "@rezics/fixture-data";
import addonMsw from "msw-storybook-addon";
import { setupWorker } from "msw/browser";
import MockDate from "mockdate";
import { loadStoryTranslation, openStoryAuthPortal, StoryProviders } from "./providers";
import { storyHandlers } from "./msw-handlers";
import { storyEnvironment } from "../../../libraries/ui/stories/environment";
import "../styles/global.css";

export default definePreview({
	addons: [
		storyEnvironment,
		addonA11y(),
		addonMsw(async () => {
			const worker = setupWorker();
			await worker.start({
				quiet: true,
				onUnhandledRequest(request, print) {
					const url = new URL(request.url);
					if (url.origin === location.origin && !url.pathname.startsWith("/api/")) return;
					print.error();
				},
			});
			return worker;
		}),
	],
	tags: ["autodocs"],
	parameters: {
		a11y: { test: "error", context: "body" },
		nextjs: { appDirectory: true },
	},
	loaders: [
		async ({ globals }) => {
			const locale = UiLocaleValues.find((value) => value === globals.locale) ?? "zh-Hant";
			return { translation: await loadStoryTranslation(locale) };
		},
	],
	beforeEach({ msw }) {
		msw.use(...storyHandlers);
		openStoryAuthPortal.mockClear();
		MockDate.set("2026-07-21T14:00:00.000Z");
		return () => MockDate.reset();
	},
	decorators: [
		(Story, context) => {
			const contentLanguage =
				FixtureContentLanguages.find((value) => value === context.globals.contentLanguage) ?? "zh";
			return (
				<StoryProviders
					key={`${context.id}:${context.globals.locale}:${contentLanguage}`}
					contentLanguage={contentLanguage}
					translation={context.loaded.translation}
				>
					<Story />
				</StoryProviders>
			);
		},
	],
});
