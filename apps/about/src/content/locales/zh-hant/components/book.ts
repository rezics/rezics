import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "書籍分區",
	book: "書籍",
	main: "主要版本",
	identity: "整體身分",
	variants: "主要版本與變體",
	contents: "章節目錄",
	history: "歷史",
	published: "已發布",
	title: "書名",
	variantDescription: "主要版本 · 變體：翻譯版本 · 內容單元 / 書籍",
	contentStructure: verbatimTerms.contentStructure.value,
	gameContentStructure: verbatimTerms.gameContentStructure.value,
	chapterOne: "01 · 章節標題",
	chapterTwo: "02 · 章節標題",
	reusedInterlude: "03 · 復用的幕間章節",
	postA: "貼文 A",
	postB: "貼文 B",
	credits: "歸屬關係",
	creditAttribution: verbatimTerms.creditAttribution.value,
	author: "作者",
	translator: "譯者",
	publisher: "出版商",
	entity: "實體記錄",
} satisfies typeof import("../../en/components/book").default;

export default content;
