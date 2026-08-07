import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: entityTerms } = zhHansTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "标签",
	kind: "类别",
	verification: "验证状态",
	owner: "所有者",
	verified: "已验证",
	unverified: "未验证",
	newEntity: `创建${entityTerms.label}`,
	newTag: "创建标签",
	externalLinksDescription: `可佐证此${entityTerms.inline}信息的公开页面。`,
	externalLinksEmpty: "目前没有外部链接。",
	relatedContentTitle: "相关内容",
	relatedContentDescription: `与此${entityTerms.inline}相关的内容。`,
	relatedContentEmptyTitle: "暂无相关内容",
	relatedContentEmptyDescription: "目前没有可显示的相关内容。",
} satisfies typeof import("../zh-Hant/entities").default;
