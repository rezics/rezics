import { definePreview } from "@storybook/react-vite";
import addonA11y from "@storybook/addon-a11y";
import { UiLocaleValues } from "@rezics/i18n";
import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { create } from "native-i18n";
import { storyEnvironment } from "./environment";

const i18n = create(resources, { timeZone: "Asia/Taipei" });

// Shared stories own renderer metadata without depending on any application's providers.
export default definePreview({
	addons: [storyEnvironment, addonA11y()],
	tags: ["autodocs"],
	parameters: { a11y: { test: "error", context: "body" } },
	loaders: [
		async ({ globals }) => {
			const locale = UiLocaleValues.find((value) => value === globals.locale) ?? "zh-Hant";
			const { t } = await i18n.getTranslation(["actions", "state", "ui"], [locale]);
			return {
				uiMessages: {
					loading: t.state.loading,
					error: t.state.error,
					empty: t.state.empty,
					unnamed: t.ui.unnamed,
					retry: t.actions.retry,
				},
			};
		},
	],
	decorators: [
		(Story, { loaded }) => (
			<UiProvider messages={loaded.uiMessages}>
				<Story />
			</UiProvider>
		),
	],
});
