const content = {
	unitTypes: "Unit 类型",
	identity: "Catalog 身份",
	description: "不设置 Work 抽象：每个 Catalog Unit 保有自身身份以及 main / variants 关系。",
	book: "Book",
	media: "Media",
	software: "Software",
	series: "Series",
	mainVariants: "main + variants",
	composition: "组合",
	selectedIdentity: "已选择的身份",
	canonicalUnit: "规范 Unit",
	stableId: "稳定 ID",
	release: "Release",
	editionContext: "版本语境",
	attribution: "归属关系",
	entityRelations: "Entity 关系",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
