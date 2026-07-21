import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — 让内容保持身份、结构与历史`,
	description: `探索 ${verbatimTerms.rezics.value} 的产品、共享能力与开放平台。`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
