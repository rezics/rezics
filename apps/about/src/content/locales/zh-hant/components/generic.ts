import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	record: "記錄",
	relations: "關係",
	history: "歷史",
	conceptPreview: "概念預覽",
	description: "一個中性、可替換的產品介面，不包含裝飾性插畫或虛構的使用指標。",
	identity: "身分",
	stableRecord: "穩定記錄",
	unit: "內容單元",
	relatedProducts: "相關產品",
	references: "引用",
	publishedState: "已發布狀態",
	sharedCapabilities: "共享能力",
	attribution: "歸屬關係",
	entity: "實體",
	tags: "標籤",
	queryable: "可查詢",
	api: verbatimTerms.api.value,
	permissioned: "受權限控制",
} satisfies typeof import("../../en/components/generic").default;

export default content;
