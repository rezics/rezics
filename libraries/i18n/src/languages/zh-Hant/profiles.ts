import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	memberSince: insert("於 {{date}} 加入", { date: String }),
	editProfile: "編輯個人資料",
	tabsLabel: "個人檔案頁面",
	tabs: {
		profile: "個人資料",
		activity: "活動",
		content: "內容",
	},
	aboutTitle: "關於",
	aboutEmpty: "這位使用者尚未填寫詳細介紹。",
	activityTitle: "評分與進度",
	activityDescription: "這裡會依每筆資料與整體隱私設定，顯示可見的評分與目前進度。",
	activityEmpty: "目前沒有可顯示的評分或進度。",
	activityScores: "評分",
	activityProgress: "進度",
	activityScoreRealm: insert(`${realmTerms.label}：{{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "待開始",
		active: "進行中",
		paused: "已暫停",
		completed: "已完成",
		dropped: "已放棄",
	},
	contentTitle: "發布內容",
	contentDescription: `公開歸屬於這位使用者的${postTerms.plural}與評論，以及其擁有的收藏集和目錄條目。`,
	contentEmptyTitle: "這裡還沒有公開內容",
	contentEmptyDescription: "這位使用者發布或擁有的公開內容會顯示在這裡。",
};
