import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "Lector",
	journey: "Journey actual",
	entrance: String(verbatimTerms.entranceNode.value),
	passageTitle: `${verbatimTerms.passageNode.value}: entrada al archivo`,
	branchDescription: `El lector llega a una ramificación documentada. El recorrido elegido se registra como ${verbatimTerms.journeyStep.value}, separado del Progreso general.`,
	choose: "Elige una opción",
	choiceA: "Opción A · Continuar a la sala de lectura",
	choiceAOutcome: `${verbatimTerms.passageNode.value}: sala de lectura`,
	choiceAStep: "Opción A → Sala de lectura",
	choiceB: "Opción B · Salir del archivo",
	choiceBOutcome: `${verbatimTerms.endingNode.value}: volver más tarde`,
	choiceBStep: `Opción B → ${verbatimTerms.endingNode.value}`,
	authoring: "Editor de creación",
	validation: `Estructura válida · comprobación ${verbatimTerms.dag.value} superada`,
	authoringSequence: `Secuencia de creación de ${verbatimTerms.gameContentStructure.value}`,
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choicesTwo: "opciones: 2",
	retirable: "retirable",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · sin bucles, scripts, variables, combates ni reglas de ejecución.`,
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
