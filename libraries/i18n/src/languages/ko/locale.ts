import { insert } from "native-i18n";

export default {
	label: "언어",
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
		zh: "중국어",
		en: "영어",
		ja: "일본어",
		ko: "한국어",
		de: "독일어",
		fr: "프랑스어",
		es: "스페인어",
	},
	draftContentLanguage: {
		label: "콘텐츠 언어",
		useAutomatic: "자동 감지 사용",
		automaticOption: insert("자동 감지 · {{language}}", { language: String }),
		manual: "직접 선택했습니다. 자동 감지가 일시 중지되었습니다.",
		idle: "감지할 만큼 내용이 입력되기 전에는 첫 번째 언어 기본 설정을 사용합니다.",
		detecting: "콘텐츠 언어를 감지하는 중…",
		detected: insert("{{language}}(으)로 자동 감지했습니다.", { language: String }),
		insufficient:
			"언어를 확실히 감지하기에 내용이 부족하여 첫 번째 언어 기본 설정을 사용합니다.",
		ambiguous: "콘텐츠 언어가 확실하지 않아 첫 번째 언어 기본 설정을 사용합니다.",
		unsupported: "감지된 언어를 아직 지원하지 않아 첫 번째 언어 기본 설정을 사용합니다.",
		failed: "언어 감지를 일시적으로 사용할 수 없어 첫 번째 언어 기본 설정을 사용합니다.",
	},
	chineseContentDisplay: {
		label: "중국어 콘텐츠 표시",
		hint: "저자의 텍스트를 수정하지 않고 중국어 콘텐츠 표시 방식을 변경합니다.",
		original: "작성자의 원문 유지",
		hant: "번체 중국어로 표시",
		hans: "간체 중국어로 표시",
	},
	displayMode: "표시 모드",
	displayModes: {
		system: "자동 (기기 설정)",
		light: "밝게",
		dark: "어둡게",
	},
} satisfies typeof import("../zh-Hant/locale").default;
