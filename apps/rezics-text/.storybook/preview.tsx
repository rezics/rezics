import { definePreview } from "@storybook/react-vite";
import addonA11y from "@storybook/addon-a11y";
import { storybookViewports } from "@rezics/storybook/viewports";
import { appThemeCss } from "@rezics/ui/theme";
import { rezicsTextLocales, rezicsTextLocaleStorageKey } from "../packages/app/src/i18n/messages";
import "../packages/web/src/styles.css";

export default definePreview({
	addons: [addonA11y()],
	tags: ["autodocs"],
	loaders: [
		async () => {
			await import("../packages/app/src/components/source-editor");
			return {};
		},
	],
	globalTypes: {
		theme: { toolbar: { icon: "paintbrush", items: ["light", "dark"] } },
		locale: { toolbar: { icon: "globe", items: [...rezicsTextLocales] } },
	},
	initialGlobals: {
		theme: "light",
		locale: "en",
		viewport: { value: "desktop", isRotated: false },
	},
	parameters: {
		layout: "fullscreen",
		a11y: { test: "error", context: "body" },
		viewport: { options: storybookViewports },
	},
	beforeEach({ globals }) {
		const previousTitle = document.title;
		const previousLocale = localStorage.getItem(rezicsTextLocaleStorageKey);
		document.documentElement.lang =
			rezicsTextLocales.find((locale) => locale === globals.locale) ?? "en";
		document.documentElement.classList.toggle("dark", globals.theme === "dark");
		document.documentElement.dataset.theme = globals.theme === "dark" ? "dark" : "light";
		return () => {
			document.title = previousTitle;
			if (previousLocale === null) localStorage.removeItem(rezicsTextLocaleStorageKey);
			else localStorage.setItem(rezicsTextLocaleStorageKey, previousLocale);
		};
	},
	decorators: [
		(Story) => (
			<>
				<style>{appThemeCss}</style>
				<Story />
			</>
		),
	],
});
