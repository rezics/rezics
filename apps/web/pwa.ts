import type { ManifestOptions } from "vite-plugin-pwa";
import type { UiLocale } from "@rezics/i18n";
import { LocalizedAppName, LocalizedPwaDescription } from "@rezics/i18n/manifest";
import { appTheme } from "@rezics/ui/theme";

type LocalizedText = Readonly<Record<UiLocale, string>>;
type LocalizedManifestOptions = Partial<ManifestOptions> & {
	name_localized: LocalizedText;
	short_name_localized: LocalizedText;
	description_localized: LocalizedText;
};

export const pwaManifest = {
	id: "/",
	name: LocalizedAppName["zh-Hant"],
	short_name: LocalizedAppName["zh-Hant"],
	description: LocalizedPwaDescription["zh-Hant"],
	name_localized: LocalizedAppName,
	short_name_localized: LocalizedAppName,
	description_localized: LocalizedPwaDescription,
	start_url: "/",
	scope: "/",
	display: "standalone",
	background_color: appTheme.light.background,
	theme_color: appTheme.light.primary,
	dir: "ltr",
	lang: "zh-Hant",
	categories: ["education", "social"],
	icons: [
		{
			src: "/icons/pwa-192x192.png",
			sizes: "192x192",
			type: "image/png",
		},
		{
			src: "/icons/pwa-512x512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "any",
		},
	],
} satisfies LocalizedManifestOptions;
