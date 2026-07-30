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
} satisfies typeof import("../zh-Hant/entities").default;
