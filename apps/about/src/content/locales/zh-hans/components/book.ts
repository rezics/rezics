import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Book 分区",
	book: "书籍",
	main: "主要版本",
	identity: "整体身份",
	variants: "main 与 variants",
	contents: "章节目录",
	history: "History",
	published: "已发布",
	title: "Book 标题",
	variantDescription: "main · 变体：translation-edition · Unit / Book",
	contentStructure: verbatimTerms.contentStructure.value,
	gameContentStructure: verbatimTerms.gameContentStructure.value,
	chapterOne: "01 · 章节标题",
	chapterTwo: "02 · 章节标题",
	reusedInterlude: "03 · 复用的幕间章节",
	postA: "Post A",
	postB: "Post B",
	credits: "归属关系",
	creditAttribution: verbatimTerms.creditAttribution.value,
	author: "作者",
	translator: "译者",
	publisher: "出版商",
	entity: "Entity 记录",
} satisfies typeof import("../../en/components/book").default;

export default content;
