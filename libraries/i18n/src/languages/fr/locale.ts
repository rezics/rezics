import { insert } from "native-i18n";

export default {
	label: "Langue",
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
		zh: "Chinois",
		en: "Anglais",
		ja: "Japonais",
		ko: "Coréen",
		de: "Allemand",
		fr: "Français",
		es: "Espagnol",
	},
	contentVersions: {
		action: "Version linguistique",
		automatic: "Automatique",
	},
	draftContentLanguage: {
		label: "Langue du contenu",
		useAutomatic: "Détecter automatiquement",
		automaticOption: insert("Automatique · {{language}}", { language: String }),
		manual: "Sélection manuelle ; la détection automatique est suspendue.",
		idle: "Votre première préférence linguistique est utilisée jusqu’à ce que le contenu soit suffisant.",
		detecting: "Détection de la langue du contenu…",
		detected: insert("Langue détectée automatiquement : {{language}}.", { language: String }),
		insufficient:
			"Le contenu est insuffisant pour une détection fiable ; votre première préférence linguistique est utilisée.",
		ambiguous:
			"La langue du contenu est incertaine ; votre première préférence linguistique est utilisée.",
		unsupported:
			"La langue détectée n’est pas encore prise en charge ; votre première préférence linguistique est utilisée.",
		failed:
			"La détection de la langue est temporairement indisponible ; votre première préférence linguistique est utilisée.",
	},
	chineseContentDisplay: {
		label: "Affichage des contenus en chinois",
		hint: "Modifie l’affichage des contenus en chinois sans altérer le texte de l’auteur.",
		original: "Conserver le texte d’origine",
		hant: "Afficher en chinois traditionnel",
		hans: "Afficher en chinois simplifié",
	},
	displayMode: "Mode d’affichage",
	displayModes: {
		system: "Automatique (réglage de l’appareil)",
		light: "Clair",
		dark: "Sombre",
	},
} satisfies typeof import("../zh-Hant/locale").default;
