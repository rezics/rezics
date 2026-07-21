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
	contentDescription: `這位使用者公開發布的${postTerms.plural}、評論與收藏集。`,
	contentEmpty: "目前沒有公開內容。",
	contentTypes: {
		posts: postTerms.plural,
		reviews: "評論",
		collections: "收藏集",
	},
};
