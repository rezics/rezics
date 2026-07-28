import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	generalProgress: "Progreso general",
	readingPosition: "Posición de lectura",
	unit: "Unidad",
	book: "Libro",
	occurrence: "Aparición",
	chapter: "Capítulo",
	position: "Posición",
	readerState: "estado del lector",
	gamebookBoundary: "Límite de Librojuego",
	progress: "Progreso",
	generalSummary: "resumen general",
	journey: "Journey",
	gamebookOwned: "propiedad de Librojuego",
	journeyStep: String(verbatimTerms.journeyStep.value),
	pathHistory: "historial del recorrido",
} satisfies typeof import("../../en/components/progress").default;

export default content;
