import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	zone: zhHansTerminology.zone.forms.label,
	blocks: "区块配置",
	query: "内容查询",
	history: "History",
	preview: "产品预览",
	path: `${zhHansTerminology.zone.forms.label} / 配置`,
	blockSchema: verbatimTerms.blockSchema.value,
	headerBlock: "Header 区块",
	feedBlock: "Feed 区块 · query: recent",
	collectionBlock: "Collection 区块 · 引用",
	feedResult: "Feed 结果",
	postCard: `${zhHansTerminology.post.forms.label}卡片`,
	catalogResult: "Catalog 结果",
	bookCard: "Book 卡片",
	discussion: "讨论",
	comment: "Comment",
} satisfies typeof import("../../en/components/zone").default;

export default content;
