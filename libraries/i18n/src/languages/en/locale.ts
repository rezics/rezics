import { insert } from "native-i18n";

export default {
	label: "Language",
	uiLocales: {
		en: "English",
		"zh-Hant": "繁體中文",
		"zh-Hans": "简体中文",
		ja: "日本語",
		ko: "한국어",
		de: "Deutsch",
		fr: "Français",
		es: "Español",
	},
	contentLanguages: {
		zh: "Chinese",
		en: "English",
		ja: "Japanese",
		ko: "Korean",
		de: "German",
		fr: "French",
		es: "Spanish",
	},
	draftContentLanguage: {
		label: "Content language",
		useAutomatic: "Detect automatically",
		automaticOption: insert("Automatic · {{language}}", { language: String }),
		manual: "Selected manually; automatic detection is paused.",
		idle: "Uses your first language preference until there is enough content to detect.",
		detecting: "Detecting the content language…",
		detected: insert("Automatically detected as {{language}}.", { language: String }),
		insufficient:
			"There is not enough content to detect reliably, so your first language preference is used.",
		ambiguous: "The content language is uncertain, so your first language preference is used.",
		unsupported:
			"The detected language is not supported yet, so your first language preference is used.",
		failed: "Language detection is temporarily unavailable, so your first language preference is used.",
	},
	chineseContentDisplay: {
		label: "Chinese content display",
		hint: "Changes how Chinese content is displayed without modifying the author's text.",
		original: "Keep the original text",
		hant: "Display in Traditional Chinese",
		hans: "Display in Simplified Chinese",
	},
	displayMode: "Display mode",
	displayModes: {
		system: "Automatic (device setting)",
		light: "Light",
		dark: "Dark",
	},
} satisfies typeof import("../zh-Hant/locale").default;
