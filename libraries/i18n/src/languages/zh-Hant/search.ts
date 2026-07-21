import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	title: "搜尋",
	placeholder: `搜尋作品、目錄、標籤、${postTerms.plural}、${realmTerms.plural}或使用者`,
	advancedFilters: "進階篩選",
	scope: "搜尋範圍",
	language: "內容語言",
	allLanguages: "全部語言",
	resetFilters: "重設篩選",
	empty: "找不到相符的內容。",
};
