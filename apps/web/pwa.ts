import type { ManifestOptions } from "vite-plugin-pwa";
import type { LanguageTag } from "@rezics/i18n";

type LocalizedText = Readonly<Record<LanguageTag, string>>;
type LocalizedManifestOptions = Partial<ManifestOptions> & {
	name_localized: LocalizedText;
	short_name_localized: LocalizedText;
	description_localized: LocalizedText;
};

const localizedName = {
	"zh-CN": "REZICS",
	"en-US": "REZICS",
} satisfies LocalizedText;

const localizedDescription = {
	"zh-CN": "inherited · create · spread",
	"en-US": "inherited · create · spread",
} satisfies LocalizedText;

export const pwaManifest = {
	id: "/",
	name: "REZICS",
	short_name: "REZICS",
	description: "inherited · create · spread",
	name_localized: localizedName,
	short_name_localized: localizedName,
	description_localized: localizedDescription,
	start_url: "/",
	scope: "/",
	display: "standalone",
	background_color: "#fcfbfa",
	theme_color: "#f23864",
	dir: "ltr",
	lang: "zh-CN",
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
