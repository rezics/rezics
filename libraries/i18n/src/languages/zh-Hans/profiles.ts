import { insert } from "native-i18n";

import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: realmTerms } = zhHansTerminology.realm;
const { forms: zoneTerms } = zhHansTerminology.zone;
const { forms: entityTerms } = zhHansTerminology.entity;

export default {
	memberSince: insert("于 {{date}} 加入", { date: String }),
	editProfile: "编辑个人资料",
	tabsLabel: "个人资料页面",
	tabs: {
		profile: "个人资料",
		activity: "活动",
		content: "内容",
	},
	aboutTitle: "关于",
	aboutEmpty: "这位用户尚未填写详细介绍。",
	activityTitle: "评分与进度",
	activityDescription: "这里会根据每条数据和整体隐私设置，显示可见的评分与当前进度。",
	activityEmpty: "目前没有可显示的评分或进度。",
	activityScores: "评分",
	activityProgress: "进度",
	activityScoreRealm: insert(`${realmTerms.label}：{{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "待开始",
		active: "进行中",
		paused: "已暂停",
		completed: "已完成",
		dropped: "已放弃",
	},
	contentTitle: "公开内容",
	contentDescription: `显示直接署名给这位用户，或通过将其署名为发布者的${entityTerms.inline}关联的公开内容，以及其拥有的${realmTerms.pluralLabel}与${zoneTerms.pluralLabel}。`,
	contentEmptyTitle: "这里还没有公开内容",
	contentEmptyDescription: `署名的公开内容及其拥有的${realmTerms.pluralLabel}或${zoneTerms.pluralLabel}会显示在这里。`,
} satisfies typeof import("../zh-Hant/profiles").default;
