import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	eyebrow: `${verbatimTerms.rezics.value}-Produktsystem`,
	title: "Inhalte behalten Identität, Struktur und Verlauf.",
	stageTitle: `${verbatimTerms.rezics.value} über echte Produktoberflächen kennenlernen`,
	productsTitle: "Jedes Produkt hat einen eigenen Einstieg",
	platformTitle: "Geteilte Fähigkeiten arbeiten produktübergreifend",
	formulaTitle: "Wie Fähigkeiten Produkte formen",
	historyTitle: "History ist das Informationsrückgrat",
	openTitle: "Offen von Dokumentation bis Quellcode",
	eyebrows: {
		stage: "Produktbühne",
		products: "Produkte",
		platform: "Plattform",
		composition: "Zusammenspiel",
		history: "Historie",
		openSource: "Open Source",
	},
	formulaResults: {
		chapters: "Kapitelstruktur",
		credits: "Beziehungen zu Autoren, Übersetzern und Verlagen",
		subjects: "Figuren-, Themen- und Ableitungsbeziehungen",
	},
} satisfies typeof import("../../en/home/labels").default;

export default content;
