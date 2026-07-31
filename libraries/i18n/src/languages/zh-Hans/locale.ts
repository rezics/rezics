import { insert } from "native-i18n";

export default {
	label: "语言",
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
		ko: "韩文",
		de: "德文",
		fr: "法文",
		es: "西班牙文",
	},
	contentVersions: {
		action: "语言版本",
		automatic: "自动选择",
	},
	draftContentLanguage: {
		label: "内容语言",
		useAutomatic: "改用自动检测",
		automaticOption: insert("自动检测 · {{language}}", { language: String }),
		manual: "已手动选择；自动检测已暂停。",
		idle: "在内容足以识别前，将使用你的第一语言偏好。",
		detecting: "正在检测内容语言……",
		detected: insert("已自动检测为{{language}}。", { language: String }),
		insufficient: "内容尚不足以可靠识别，将使用你的第一语言偏好。",
		ambiguous: "无法可靠判断内容语言，将使用你的第一语言偏好。",
		unsupported: "检测到目前不支持的语言，将使用你的第一语言偏好。",
		failed: "语言检测暂时无法使用，将使用你的第一语言偏好。",
	},
	chineseContentDisplay: {
		label: "中文内容显示",
		hint: "只改变中文内容的显示方式，不会修改作者原文。",
		original: "保留作者原文",
		hant: "显示为繁体中文",
		hans: "显示为简体中文",
	},
	displayMode: "显示模式",
	displayModes: {
		system: "自动（依设备设置）",
		light: "浅色",
		dark: "深色",
	},
} satisfies typeof import("../zh-Hant/locale").default;
