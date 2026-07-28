import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `Estructura válida · comprobación ${verbatimTerms.dag.value} superada`,
	structure: "Editor de estructura",
	treeMode: "Modo Árbol",
	gameMode: "Modo Juego",
	path: "Estructura de contenido / adaptador de Libro",
	orderedTree: `${verbatimTerms.contentStructure.value} · árbol ordenado`,
	bookRoot: "Raíz del libro",
	partOccurrence: "Parte I · aparición",
	postAOccurrence: `${esTerminology.post.forms.label} A · aparición 01`,
	postBOccurrence: `${esTerminology.post.forms.label} B · aparición 02`,
	reusedOccurrence: `${esTerminology.post.forms.label} A · aparición reutilizada 03`,
	bookReaderResult: "Resultado del lector de Libro",
	partOne: "Parte I",
	section: "sección",
	chapterOne: "Capítulo 01",
	chapterTwo: "Capítulo 02",
	postA: `${esTerminology.post.forms.label} A`,
	postB: `${esTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · capa de grafo opcional`,
	entrance: String(verbatimTerms.entranceNode.value),
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choiceAB: "Opción A / B",
	terminal: String(verbatimTerms.terminalEdge.value),
	gamebookReaderResult: "Resultado del lector de Librojuego",
	currentPassage: `${verbatimTerms.passageNode.value} actual`,
	stableId: "identificador estable",
	availableChoices: "Opciones disponibles",
	choicesCount: "2",
	journeyStep: String(verbatimTerms.journeyStep.value),
	separate: "separado",
} satisfies typeof import("../../en/components/structure").default;

export default content;
