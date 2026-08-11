import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: postTerms } = zhHansTerminology.post;
const { forms: realmTerms } = zhHansTerminology.realm;
const { forms: entityTerms } = zhHansTerminology.entity;
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
	entityHelp: {
		label: "打开署名说明",
		title: "署名说明",
		description: `署名需要关联${entityTerms.inline}。如果搜索不到${entityTerms.inline}，或想创建例如代表自己的作者身份，请先创建${entityTerms.inline}。`,
		createEntity: `创建${entityTerms.inline}`,
		close: "关闭",
	},
	sections: {
		book: { label: "书籍", description: "查看及管理与您相关的书籍。" },
		software: { label: "软件", description: "查看及管理与您相关的软件条目。" },
		media: { label: "媒体", description: "查看及管理与您相关的媒体内容。" },
		entity: {
			label: entityTerms.pluralLabel,
			description: `查看及管理与您相关的${entityTerms.plural}。`,
		},
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
	communityUnitSearch: {
		policyTitle: "创建前请先搜索",
		policy:
			"为了维护良好的社区环境，创建公共条目前，请先搜索并确认您想创建的内容尚不存在。如果您滥用创建公共条目的权限，可能会受到处罚。",
		confirmationLabel: insert("我已检查现有{{subject}}，并确认这个条目尚不存在。", {
			subject: String,
		}),
		prompt: insert("搜索现有{{subject}}", { subject: String }),
		pageTitle: insert("搜索现有{{subject}}", { subject: String }),
		pageDescription: insert("先确认您想创建的{{subject}}是否已存在。", {
			subject: String,
		}),
		backToSection: insert("返回{{subject}}", { subject: String }),
		searchLabel: insert("搜索{{subject}}", { subject: String }),
		searchPlaceholder: insert("输入{{subject}}的名称", { subject: String }),
		searchAction: "搜索",
		searchHint: "输入名称以搜索可能已存在的条目。",
		searchFailed: "搜索暂时不可用。请重试，或返回创建表单。",
		resultsTitle: "可能已经存在的条目",
		noResultsTitle: insert("未找到匹配的{{subject}}", { subject: String }),
		noResultsDescription: "确认搜索词正确后，您可以继续前往创建。",
		realmTagContextOnly: `这里只会显示该${realmTerms.label}已正式说明的标签。如果缺少标签，请先由${realmTerms.label}管理员创建标签说明。`,
		notListedTitle: "这些结果都不是您要找的内容？",
		notListedDescription: "请先检查相似条目；如果都不匹配，再继续创建新条目。",
		createAction: "继续创建",
		subjects: {
			book: "书籍",
			software: "软件",
			media: "媒体",
			person: "人物",
			organization: "组织",
			character: "角色",
			tag: "标签",
		},
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
			"unit.realm-publication.manage": `可管理${realmTerms.label}发布`,
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
