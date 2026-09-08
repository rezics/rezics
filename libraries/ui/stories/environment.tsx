import type { Preview } from "@storybook/react-vite";
import { FixtureProvider } from "@rezics/fixture-client";
import { FixtureContentLanguages } from "@rezics/fixture-data";
import { UiLocaleValues } from "@rezics/i18n";
import { appThemeCss } from "@rezics/ui/theme";
import "./styles.css";

// A native preview addon shared by the library and application CSF Next factories.
export const storyEnvironment = {
	globalTypes: {
		theme: { toolbar: { icon: "paintbrush", items: ["light", "dark"], dynamicTitle: true } },
		locale: { toolbar: { icon: "globe", items: [...UiLocaleValues], dynamicTitle: true } },
		contentLanguage: {
			toolbar: { icon: "book", items: [...FixtureContentLanguages], dynamicTitle: true },
		},
	},
	initialGlobals: {
		theme: "light",
		locale: "zh-Hant",
		contentLanguage: "zh",
		viewport: { value: "desktop", isRotated: false },
	},
	parameters: {
		layout: "padded",
		controls: { expanded: true },
		a11y: { test: "error", context: "body" },
		viewport: {
			options: {
				mobile: { name: "Mobile", styles: { width: "390px", height: "844px" }, type: "mobile" },
				tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" }, type: "tablet" },
				desktop: { name: "Desktop", styles: { width: "1280px", height: "900px" }, type: "desktop" },
			},
		},
	},
	beforeEach({ globals }) {
		document.documentElement.lang =
			UiLocaleValues.find((value) => value === globals.locale) ?? "zh-Hant";
		document.documentElement.classList.toggle("dark", globals.theme === "dark");
		document.documentElement.dataset.theme = globals.theme === "dark" ? "dark" : "light";
	},
	decorators: [
		(Story, context) => {
			const contentLanguage =
				FixtureContentLanguages.find((value) => value === context.globals.contentLanguage) ?? "zh";
			return (
				<FixtureProvider contentLanguage={contentLanguage}>
					<style>{appThemeCss}</style>
					<div className="mx-auto w-full min-w-0 max-w-3xl">
						<Story />
					</div>
				</FixtureProvider>
			);
		},
	],
} satisfies Preview;
