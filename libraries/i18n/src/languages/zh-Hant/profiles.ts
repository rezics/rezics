import { insert } from "native-i18n";

import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: zoneTerms } = zhHantTerminology.zone;
const { forms: entityTerms } = zhHantTerminology.entity;

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
	contentTitle: "公開內容",
	contentDescription: `顯示直接署名給這位使用者，或透過將其署名為發布者的${entityTerms.inline}連結的公開內容，以及其擁有的${realmTerms.pluralLabel}與${zoneTerms.pluralLabel}。`,
	contentEmptyTitle: "這裡還沒有公開內容",
	contentEmptyDescription: `署名的公開內容及其擁有的${realmTerms.pluralLabel}或${zoneTerms.pluralLabel}會顯示在這裡。`,
};
