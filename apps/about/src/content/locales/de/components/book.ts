import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Book-Abschnitte",
	book: "Buch",
	main: "Hauptfassung",
	identity: "Buchidentität",
	variants: "main und variants",
	contents: "Kapitelstruktur",
	history: "History",
	published: "Veröffentlicht",
	title: "Book-Titel",
	variantDescription: "main · variant: translation-edition · Unit / Book",
	contentStructure: verbatimTerms.contentStructure.value,
	gameContentStructure: verbatimTerms.gameContentStructure.value,
	chapterOne: "01 · Kapitelüberschrift",
	chapterTwo: "02 · Kapitelüberschrift",
	reusedInterlude: "03 · Wiederverwendetes Intermezzo",
	postA: "Post A",
	postB: "Post B",
	credits: "Zuordnungen",
	creditAttribution: verbatimTerms.creditAttribution.value,
	author: "Autor",
	translator: "Übersetzer",
	publisher: "Verlag",
	entity: "Entity-Datensatz",
} satisfies typeof import("../../en/components/book").default;

export default content;
