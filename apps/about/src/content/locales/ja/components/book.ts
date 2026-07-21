import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Book のセクション",
	book: "書籍",
	main: "メイン版",
	identity: "書籍の同一性",
	variants: "main と variants",
	contents: "章構造",
	history: "History",
	published: "公開済み",
	title: "Book のタイトル",
	variantDescription: "main · variant: translation-edition · Unit / Book",
	contentStructure: verbatimTerms.contentStructure.value,
	gameContentStructure: verbatimTerms.gameContentStructure.value,
	chapterOne: "01 · 章タイトル",
	chapterTwo: "02 · 章タイトル",
	reusedInterlude: "03 · 再利用された幕間",
	postA: "Post A",
	postB: "Post B",
	credits: "帰属関係",
	creditAttribution: verbatimTerms.creditAttribution.value,
	author: "著者",
	translator: "翻訳者",
	publisher: "出版社",
	entity: "Entity レコード",
} satisfies typeof import("../../en/components/book").default;

export default content;
