import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `联系 ${verbatimTerms.rezics.value}`,
		description: `联系 ${verbatimTerms.rezics.value} 项目维护者，讨论参与开发与合作事宜。`,
	},
	eyebrow: "联系我们",
	title: "一起构建开放的内容基础设施",
	introduction: "如果您想参与开发、报告问题或讨论合作，欢迎通过以下方式联系我们。",
	role: "项目维护者",
	emailLabel: "电子邮件",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
