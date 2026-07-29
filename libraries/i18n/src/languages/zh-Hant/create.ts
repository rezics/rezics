import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "集中查看您建立、參與維護或獲指派管理的內容。",
		backToApplication: `返回 ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} 導覽`,
		overview: "內容類型",
		backToOverview: "返回內容類型",
	},
	sections: {
		book: { label: "書籍", description: "查看及管理與您相關的書籍。" },
		software: { label: "軟體", description: "查看及管理與您相關的軟體條目。" },
		media: { label: "媒體", description: "查看及管理與您相關的媒體內容。" },
		entity: { label: "目錄條目", description: "查看及管理與您相關的目錄條目。" },
		tag: { label: "標籤", description: "查看及管理與您相關的標籤。" },
		realm: {
			label: realmTerms.label,
			description: `查看及管理與您相關的${realmTerms.label}。`,
		},
		zone: { label: zoneTerms.label, description: `查看及管理與您相關的${zoneTerms.label}。` },
		post: { label: postTerms.label, description: `查看及管理與您相關的${postTerms.label}。` },
		wiki: { label: "百科文章", description: "查看及管理您參與維護的百科文章。" },
		collection: { label: "收藏集", description: "查看及管理與您相關的收藏集。" },
		review: { label: "評論", description: "查看及管理與您相關的評論。" },
		poll: { label: "投票", description: "查看及管理與您相關的投票。" },
	},
	realmTagContext: {
		label: `${realmTerms.label}標籤解釋`,
		description: `建立此${realmTerms.label}對某個標籤的百科說明。`,
	},
	list: {
		create: "建立",
		empty: "沒有符合目前篩選條件的內容。",
		untitled: "未命名內容",
		contributionCount: insert("貢獻 {{count}} 次", { count: Number }),
		activity: {
			visited: "最近瀏覽",
			updated: "最近更新",
			created: "建立",
			relevant: "最近與我相關",
		},
	},
	filters: {
		viewLabel: "工作關係",
		permissionLabel: "目前權限",
		workStateLabel: "工作狀態",
		statusLabel: "內容狀態",
		visibilityLabel: "可見性",
		sortLabel: "排序方式",
		any: "不限",
		more: "更多篩選",
		clear: "清除篩選",
		cancel: "取消",
		apply: "套用篩選",
		views: {
			all: "我的工作",
			created: "我建立的",
			contributed: "我貢獻的",
			assigned: "直接指派給我的",
			delegated: "團隊委派",
		},
		permissions: {
			"unit.update": "可編輯",
			"unit.status.update": "可變更狀態",
			"unit.access.manage": "可管理存取權",
		},
		workStates: { actionable: "可操作", blocked: "目前受阻" },
		statuses: { draft: "草稿", published: "已發布", archived: "已封存" },
		visibilities: { public: "公開", unlisted: "不列出", private: "私人" },
		sorts: {
			recent: "最近瀏覽",
			updated: "最近更新",
			created: "最近建立",
			relevant: "最近與我相關",
		},
	},
	relations: {
		created: "建立者",
		contributed: "貢獻者",
		assigned: "直接指派",
		delegated: "團隊委派",
		blocked: "目前受阻",
	},
	developmentBadge: "開發中",
};
