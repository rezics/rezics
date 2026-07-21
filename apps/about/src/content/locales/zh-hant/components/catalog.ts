import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	unitTypes: "內容單元類型",
	identity: "作品目錄身分",
	description: "不另設作品抽象：作品目錄中的每個內容單元都保有自身身分，以及主要版本與變體關係。",
	book: "書籍",
	media: "媒體",
	software: "軟體",
	series: "系列",
	mainVariants: "主要版本 + 變體",
	composition: "組合",
	selectedIdentity: "已選擇的身分",
	canonicalUnit: "規範內容單元",
	stableId: `穩定 ${verbatimTerms.id.value}`,
	release: "發行",
	editionContext: "版本語境",
	attribution: "歸屬關係",
	entityRelations: "實體關係",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
