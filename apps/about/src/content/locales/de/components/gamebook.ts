import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "Leseansicht",
	journey: "Aktuelle Journey",
	entrance: verbatimTerms.entranceNode.value,
	passageTitle: `${verbatimTerms.passageNode.value}: Archiveingang`,
	branchDescription: `Die lesende Person erreicht eine dokumentierte Verzweigung. Der gewählte Pfad wird als ${verbatimTerms.journeyStep.value} erfasst, getrennt vom allgemeinen Progress.`,
	choose: "Auswahl treffen",
	choiceA: "Choice A · Weiter zum Lesesaal",
	choiceAOutcome: `${verbatimTerms.passageNode.value}: Lesesaal`,
	choiceAStep: "Choice A → Lesesaal",
	choiceB: "Choice B · Archiv verlassen",
	choiceBOutcome: `${verbatimTerms.endingNode.value}: Später zurückkehren`,
	choiceBStep: `Choice B → ${verbatimTerms.endingNode.value}`,
	authoring: "Bearbeitung",
	validation: `Gültige Struktur · ${verbatimTerms.dag.value}-Prüfung bestanden`,
	authoringSequence: `Bearbeitungssequenz für ${verbatimTerms.gameContentStructure.value}`,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: "Einstieg",
	choicesTwo: "Auswahlmöglichkeiten: 2",
	retirable: "stilllegbar",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · keine Schleifen, Skripte, Variablen, Kämpfe oder Laufzeitregeln.`,
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
