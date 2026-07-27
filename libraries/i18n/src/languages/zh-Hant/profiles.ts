import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;

export default {
	memberSince: insert("於 {{date}} 加入", { date: String }),
	editProfile: "編輯個人資料",
	tabsLabel: "個人檔案頁面",
	tabs: {
		profile: "個人資料",
		content: "內容",
	},
	aboutTitle: "關於",
	aboutEmpty: "這位使用者尚未填寫詳細介紹。",
	contentTitle: "發布內容",
	contentDescription: `公開歸屬於這位使用者的${postTerms.plural}與評論，以及其擁有的收藏集和目錄條目。`,
	contentEmptyTitle: "這裡還沒有公開內容",
	contentEmptyDescription: "這位使用者發布或擁有的公開內容會顯示在這裡。",
};
