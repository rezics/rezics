import { insert } from "native-i18n";

import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: postTerms } = zhHansTerminology.post;

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
	activityScoreContext: insert("语境：{{context}}", { context: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "待开始",
		active: "进行中",
		paused: "已暂停",
		completed: "已完成",
		dropped: "已放弃",
	},
	contentTitle: "发布内容",
	contentDescription: `公开归属于这位用户的${postTerms.plural}与评论，以及其拥有的收藏集和目录条目。`,
	contentEmptyTitle: "这里还没有公开内容",
	contentEmptyDescription: "这位用户发布或拥有的公开内容会显示在这里。",
} satisfies typeof import("../zh-Hant/profiles").default;
