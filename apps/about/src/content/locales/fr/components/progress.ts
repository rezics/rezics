import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	generalProgress: "Progression générale",
	readingPosition: "Position de lecture",
	unit: "Unit",
	book: "Livre",
	occurrence: "Occurrence",
	chapter: "Chapitre",
	position: "Position",
	readerState: "état du lecteur",
	gamebookBoundary: "Périmètre du livre-jeu",
	progress: "Progression",
	generalSummary: "résumé général",
	journey: "Parcours",
	gamebookOwned: "propre au livre-jeu",
	journeyStep: String(verbatimTerms.journeyStep.value),
	pathHistory: "historique du chemin",
} satisfies typeof import("../../en/components/progress").default;

export default content;
