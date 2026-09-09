import { definePreview } from "@storybook/react-vite";
import addonA11y from "@storybook/addon-a11y";
import { storybookViewports } from "@rezics/storybook/viewports";
import { ABOUT_LOCALES, ABOUT_LOCALE_META, isAboutLocale } from "../src/i18n/locales";
import "../src/styles/site.css";

export default definePreview({
	addons: [addonA11y()],
	tags: ["autodocs"],
	globalTypes: {
		theme: { toolbar: { icon: "paintbrush", items: ["light", "dark"] } },
		locale: { toolbar: { icon: "globe", items: [...ABOUT_LOCALES] } },
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
		const previousTheme = localStorage.getItem("rezics-theme");
		const locale =
			typeof globals.locale === "string" && isAboutLocale(globals.locale) ? globals.locale : "en";
		document.documentElement.lang = ABOUT_LOCALE_META[locale].htmlLang;
		document.documentElement.classList.toggle("dark", globals.theme === "dark");
		document.documentElement.dataset.theme = globals.theme === "dark" ? "dark" : "light";
		localStorage.removeItem("rezics-theme");
		return () => {
			if (previousTheme === null) localStorage.removeItem("rezics-theme");
			else localStorage.setItem("rezics-theme", previousTheme);
			document.body.classList.remove("menu-open");
		};
	},
});
