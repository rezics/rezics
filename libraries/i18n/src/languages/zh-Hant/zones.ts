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
	searchResults: "搜尋結果",
	searchEmpty: "找不到符合條件的內容。",
	searchFailed: "搜尋暫時無法使用，請稍後再試。",
	untitledResult: "未命名內容",
	contentList: "內容清單",
};
