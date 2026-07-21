import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	generalProgress: "Allgemeiner Fortschritt",
	readingPosition: "Leseposition",
	unit: "Unit",
	book: "Book",
	occurrence: "Vorkommen",
	chapter: "Kapitel",
	position: "Position",
	readerState: "Lesestatus",
	gamebookBoundary: "GameBook-Grenze",
	progress: "Progress",
	generalSummary: "allgemeine Zusammenfassung",
	journey: "Journey",
	gamebookOwned: "von GameBook verwaltet",
	journeyStep: verbatimTerms.journeyStep.value,
	pathHistory: "Pfadverlauf",
} satisfies typeof import("../../en/components/progress").default;

export default content;
