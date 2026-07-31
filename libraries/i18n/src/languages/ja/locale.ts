import { insert } from "native-i18n";

export default {
	label: "言語",
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
		zh: "中国語",
		en: "英語",
		ja: "日本語",
		ko: "韓国語",
		de: "ドイツ語",
		fr: "フランス語",
		es: "スペイン語",
	},
	contentVersions: {
		action: "言語版",
		automatic: "自動選択",
	},
	draftContentLanguage: {
		label: "コンテンツの言語",
		useAutomatic: "自動検出に戻す",
		automaticOption: insert("自動検出 · {{language}}", { language: String }),
		manual: "手動で選択されています。自動検出は停止中です。",
		idle: "検出に十分な内容が入力されるまでは、第一言語の設定を使用します。",
		detecting: "コンテンツの言語を検出しています…",
		detected: insert("{{language}}として自動検出されました。", { language: String }),
		insufficient: "確実に検出できる内容量ではないため、第一言語の設定を使用します。",
		ambiguous: "言語を確実に判定できないため、第一言語の設定を使用します。",
		unsupported: "検出された言語は未対応のため、第一言語の設定を使用します。",
		failed: "言語検出を一時的に利用できないため、第一言語の設定を使用します。",
	},
	chineseContentDisplay: {
		label: "中国語コンテンツ表示",
		hint: "著者のテキストを変更せずに、中国語コンテンツの表示方法を変更します。",
		original: "作者の原文を保持",
		hant: "繁体字で表示",
		hans: "簡体字で表示",
	},
	displayMode: "表示モード",
	displayModes: {
		system: "自動（デバイス設定）",
		light: "ライト",
		dark: "ダーク",
	},
} satisfies typeof import("../zh-Hant/locale").default;
