import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	navigation: `${zoneTerms.label}導覽`,
	openNavigation: `開啟${zoneTerms.label}導覽`,
	openMenu: insert("開啟「{{label}}」選單", { label: String }),
	emptyTitle: `此${zoneTerms.inline}尚未設定首頁`,
	emptyBody: `${zoneTerms.inline}管理者尚未發布首頁內容。`,
	searchTitle: `搜尋此${zoneTerms.inline}`,
	searchPlaceholder: "輸入關鍵字",
	searchSubmit: "搜尋",
	searchMode: "搜尋模式",
	searchModes: { basic: "基本", advanced: "進階" },
	searchBoolean: { yes: "是", no: "否" },
	searchFilters: "搜尋篩選條件",
	searchControl: insert("篩選：{{name}}", { name: String }),
	searchSelect: "選擇條件",
	searchOperator: "比對方式",
	searchOperators: {
		equals: "等於",
		notEquals: "不等於",
		anyOf: "包含任一項",
		allOf: "包含全部",
		noneOf: "排除全部",
		range: "範圍",
		exists: "是否存在",
	},
	searchRangeLower: "範圍下限",
	searchRangeUpper: "範圍上限",
	searchResults: "搜尋結果",
	searchEmpty: "找不到符合條件的內容。",
	searchFailed: "搜尋暫時無法使用，請稍後再試。",
	untitledResult: "未命名內容",
	contentList: "內容清單",
};
