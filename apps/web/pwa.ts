import type { ManifestOptions } from "vite-plugin-pwa";
import type { UiLocale } from "@rezics/i18n";

import { appTheme } from "./lib/theme";

type LocalizedText = Readonly<Record<UiLocale, string>>;
type LocalizedManifestOptions = Partial<ManifestOptions> & {
	name_localized: LocalizedText;
	short_name_localized: LocalizedText;
	description_localized: LocalizedText;
};

const localizedName = {
	"zh-Hant": "REZICS",
	en: "REZICS",
} satisfies LocalizedText;

const localizedDescription = {
	"zh-Hant": "發現作品，加入社群，展開深度討論。",
	en: "Discover works, join communities, and take part in thoughtful discussion.",
} satisfies LocalizedText;

export const pwaManifest = {
	id: "/",
	name: "REZICS",
	short_name: "REZICS",
	description: localizedDescription["zh-Hant"],
	name_localized: localizedName,
	short_name_localized: localizedName,
	description_localized: localizedDescription,
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
