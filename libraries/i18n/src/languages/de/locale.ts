import { insert } from "native-i18n";

export default {
	label: "Sprache",
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
		zh: "Chinesisch",
		en: "Englisch",
		ja: "Japanisch",
		ko: "Koreanisch",
		de: "Deutsch",
		fr: "Französisch",
		es: "Spanisch",
	},
	draftContentLanguage: {
		label: "Inhaltssprache",
		useAutomatic: "Automatisch erkennen",
		automaticOption: insert("Automatisch · {{language}}", { language: String }),
		manual: "Manuell ausgewählt; die automatische Erkennung ist pausiert.",
		idle: "Bis genügend Inhalt vorhanden ist, wird deine erste Sprachpräferenz verwendet.",
		detecting: "Inhaltssprache wird erkannt…",
		detected: insert("Automatisch als {{language}} erkannt.", { language: String }),
		insufficient:
			"Für eine zuverlässige Erkennung ist der Inhalt zu kurz; deine erste Sprachpräferenz wird verwendet.",
		ambiguous:
			"Die Inhaltssprache ist nicht eindeutig; deine erste Sprachpräferenz wird verwendet.",
		unsupported:
			"Die erkannte Sprache wird noch nicht unterstützt; deine erste Sprachpräferenz wird verwendet.",
		failed: "Die Spracherkennung ist vorübergehend nicht verfügbar; deine erste Sprachpräferenz wird verwendet.",
	},
	chineseContentDisplay: {
		label: "Darstellung chinesischer Inhalte",
		hint: "Ändert die Darstellung chinesischer Inhalte, ohne den Text des Autors zu verändern.",
		original: "Originaltext beibehalten",
		hant: "Auf traditionellem Chinesisch anzeigen",
		hans: "Auf vereinfachtem Chinesisch anzeigen",
	},
	displayMode: "Darstellungsmodus",
	displayModes: {
		system: "Automatisch (Geräteeinstellung)",
		light: "Hell",
		dark: "Dunkel",
	},
} satisfies typeof import("../zh-Hant/locale").default;
