import { insert } from "native-i18n";

export default {
	label: "語言",
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
		zh: "中文",
		en: "英文",
		ja: "日文",
		ko: "韓文",
		de: "德文",
		fr: "法文",
		es: "西班牙文",
	},
	contentVersions: {
		action: "語言版本",
		automatic: "自動選擇",
	},
	draftContentLanguage: {
		label: "內容語言",
		useAutomatic: "改用自動偵測",
		automaticOption: insert("自動偵測 · {{language}}", { language: String }),
		manual: "已手動選擇；自動偵測已暫停。",
		idle: "在內容足以辨識前，會使用你的第一語言偏好。",
		detecting: "正在偵測內容語言⋯⋯",
		detected: insert("已自動偵測為{{language}}。", { language: String }),
		insufficient: "內容尚不足以可靠辨識，會使用你的第一語言偏好。",
		ambiguous: "無法可靠判斷內容語言，會使用你的第一語言偏好。",
		unsupported: "偵測到目前不支援的語言，會使用你的第一語言偏好。",
		failed: "語言偵測暫時無法使用，會使用你的第一語言偏好。",
	},
	chineseContentDisplay: {
		label: "中文內容顯示",
		hint: "只改變中文內容的顯示方式，不會修改作者原文。",
		original: "保留作者原文",
		hant: "顯示為繁體中文",
		hans: "顯示為簡體中文",
	},
	displayMode: "顯示模式",
	displayModes: {
		system: "自動（依裝置設定）",
		light: "淺色",
		dark: "深色",
	},
};
