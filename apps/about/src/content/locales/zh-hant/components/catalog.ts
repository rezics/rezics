const content = {
	unitTypes: "Unit 類型",
	identity: "Catalog 身份",
	description: "不設置 Work 抽象：每個 Catalog Unit 保有自身身份以及 main / variants 關係。",
	book: "Book",
	media: "Media",
	software: "Software",
	series: "Series",
	mainVariants: "main + variants",
	composition: "組合",
	selectedIdentity: "已選擇的身份",
	canonicalUnit: "規範 Unit",
	stableId: "穩定 ID",
	release: "Release",
	editionContext: "版本語境",
	attribution: "歸屬關係",
	entityRelations: "Entity 關係",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
