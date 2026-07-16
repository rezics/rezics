const content = {
	unitTypes: "Unit-Typen",
	identity: "Catalog-Identität",
	description:
		"Keine Work-Abstraktion: Jede Catalog-Unit behält ihre eigene Identität und ihre Beziehung zwischen main und variants.",
	book: "Book",
	media: "Media",
	software: "Software",
	series: "Series",
	mainVariants: "main + variants",
	composition: "Zusammensetzung",
	selectedIdentity: "Ausgewählte Identität",
	canonicalUnit: "Kanonische Unit",
	stableId: "stabile ID",
	release: "Release",
	editionContext: "Editionskontext",
	attribution: "Attribution",
	entityRelations: "Entity-Beziehungen",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
