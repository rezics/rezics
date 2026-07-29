import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: postTerms } = zhHansTerminology.post;
const { forms: realmTerms } = zhHansTerminology.realm;
const { forms: zoneTerms } = zhHansTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "集中查看您创建、参与维护或获指派管理的内容。",
		backToApplication: `返回 ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} 导航`,
		overview: "内容类型",
		backToOverview: "返回内容类型",
	},
	sections: {
		book: { label: "书籍", description: "查看及管理与您相关的书籍。" },
		software: { label: "软件", description: "查看及管理与您相关的软件条目。" },
		media: { label: "媒体", description: "查看及管理与您相关的媒体内容。" },
		entity: { label: "目录条目", description: "查看及管理与您相关的目录条目。" },
		tag: { label: "标签", description: "查看及管理与您相关的标签。" },
		realm: {
			label: realmTerms.label,
			description: `查看及管理与您相关的${realmTerms.label}。`,
		},
		zone: { label: zoneTerms.label, description: `查看及管理与您相关的${zoneTerms.label}。` },
		post: { label: postTerms.label, description: `查看及管理与您相关的${postTerms.label}。` },
		wiki: { label: "百科文章", description: "查看及管理您参与维护的百科文章。" },
		collection: { label: "收藏集", description: "查看及管理与您相关的收藏集。" },
		review: { label: "评论", description: "查看及管理与您相关的评论。" },
		poll: { label: "投票", description: "查看及管理与您相关的投票。" },
	},
	realmTagContext: {
		label: `${realmTerms.label}标签解释`,
		description: `创建此${realmTerms.label}对某个标签的百科说明。`,
	},
	list: {
		create: "创建",
		empty: "没有符合当前筛选条件的内容。",
		untitled: "未命名内容",
		contributionCount: insert("贡献 {{count}} 次", { count: Number }),
		activity: {
			visited: "最近浏览",
			updated: "最近更新",
			created: "创建",
			relevant: "最近与我相关",
		},
	},
	filters: {
		viewLabel: "工作关系",
		permissionLabel: "当前权限",
		workStateLabel: "工作状态",
		statusLabel: "内容状态",
		visibilityLabel: "可见性",
		sortLabel: "排序方式",
		any: "不限",
		more: "更多筛选",
		clear: "清除筛选",
		cancel: "取消",
		apply: "应用筛选",
		views: {
			all: "我的工作",
			created: "我创建的",
			contributed: "我贡献的",
			assigned: "直接指派给我的",
			delegated: "团队委派",
		},
		permissions: {
			"unit.update": "可编辑",
			"unit.status.update": "可变更状态",
			"unit.access.manage": "可管理访问权",
		},
		workStates: { actionable: "可操作", blocked: "当前受阻" },
		statuses: { draft: "草稿", published: "已发布", archived: "已封存" },
		visibilities: { public: "公开", unlisted: "不列出", private: "私人" },
		sorts: {
			recent: "最近浏览",
			updated: "最近更新",
			created: "最近创建",
			relevant: "最近与我相关",
		},
	},
	relations: {
		created: "创建者",
		contributed: "贡献者",
		assigned: "直接指派",
		delegated: "团队委派",
		blocked: "当前受阻",
	},
	developmentBadge: "开发中",
} satisfies typeof import("../zh-Hant/create").default;
