import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	record: "Datensatz",
	relations: "Beziehungen",
	history: "History",
	conceptPreview: "Konzeptvorschau",
	description:
		"Eine neutrale, austauschbare Produktoberfläche. Sie enthält weder dekorative Illustrationen noch erfundene Nutzungskennzahlen.",
	identity: "Identität",
	stableRecord: "Stabiler Datensatz",
	unit: "Unit",
	relatedProducts: "Verwandte Produkte",
	references: "Referenzen",
	publishedState: "Veröffentlichter Zustand",
	sharedCapabilities: "Geteilte Fähigkeiten",
	attribution: "Attribution",
	entity: "Entity",
	tags: "Tags",
	queryable: "abfragbar",
	api: verbatimTerms.api.value,
	permissioned: "zugriffsbeschränkt",
} satisfies typeof import("../../en/components/generic").default;

export default content;
