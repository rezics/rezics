import { insert } from "native-i18n";

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
	contentDescription: "這位使用者公開發布的貼文、評論與收藏集。",
	contentEmpty: "目前沒有公開內容。",
	contentTypes: {
		posts: "貼文",
		reviews: "評論",
		collections: "收藏集",
	},
};
