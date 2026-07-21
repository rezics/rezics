import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	zone: "專區",
	blocks: "區塊配置",
	query: "內容查詢",
	history: "歷史",
	preview: "產品預覽",
	path: "專區 / 配置",
	blockSchema: verbatimTerms.blockSchema.value,
	headerBlock: "頁首區塊",
	feedBlock: "動態區塊 · 查詢：最新",
	collectionBlock: "收藏區塊 · 引用",
	feedResult: "動態結果",
	postCard: "貼文卡片",
	catalogResult: "作品目錄結果",
	bookCard: "書籍卡片",
	discussion: "討論",
	comment: "留言",
} satisfies typeof import("../../en/components/zone").default;

export default content;
