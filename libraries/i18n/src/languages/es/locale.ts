import { insert } from "native-i18n";

export default {
	label: "Idioma",
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
		zh: "Chino",
		en: "Inglés",
		ja: "Japonés",
		ko: "Coreano",
		de: "Alemán",
		fr: "Francés",
		es: "Español",
	},
	contentVersions: {
		action: "Versión de idioma",
		automatic: "Automática",
	},
	draftContentLanguage: {
		label: "Idioma del contenido",
		useAutomatic: "Detectar automáticamente",
		automaticOption: insert("Automático · {{language}}", { language: String }),
		manual: "Selección manual; la detección automática está en pausa.",
		idle: "Se usa tu primera preferencia de idioma hasta que haya suficiente contenido para detectarlo.",
		detecting: "Detectando el idioma del contenido…",
		detected: insert("Detectado automáticamente como {{language}}.", { language: String }),
		insufficient:
			"No hay suficiente contenido para detectarlo con fiabilidad, así que se usa tu primera preferencia de idioma.",
		ambiguous:
			"El idioma del contenido no está claro, así que se usa tu primera preferencia de idioma.",
		unsupported:
			"El idioma detectado aún no es compatible, así que se usa tu primera preferencia de idioma.",
		failed:
			"La detección de idioma no está disponible temporalmente, así que se usa tu primera preferencia de idioma.",
	},
	chineseContentDisplay: {
		label: "Visualización del contenido en chino",
		hint: "Cambia cómo se muestra el contenido en chino sin modificar el texto de su autor.",
		original: "Mantener el texto original",
		hant: "Mostrar en chino tradicional",
		hans: "Mostrar en chino simplificado",
	},
	displayMode: "Modo de visualización",
	displayModes: {
		system: "Automático (ajuste del dispositivo)",
		light: "Claro",
		dark: "Oscuro",
	},
} satisfies typeof import("../zh-Hant/locale").default;
