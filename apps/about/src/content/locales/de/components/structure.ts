import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `Gültige Struktur · ${verbatimTerms.dag.value}-Prüfung bestanden`,
	structure: "Struktur-Editor",
	treeMode: "Baummodus",
	gameMode: "Spielmodus",
	path: `${verbatimTerms.contentStructure.value} / Book-Adapter`,
	orderedTree: `${verbatimTerms.contentStructure.value} · geordneter Baum`,
	bookRoot: "Book-Wurzel",
	partOccurrence: "Teil I · Vorkommen",
	postAOccurrence: `${deTerminology.post.forms.label} A · Vorkommen 01`,
	postBOccurrence: `${deTerminology.post.forms.label} B · Vorkommen 02`,
	reusedOccurrence: `${deTerminology.post.forms.label} A · wiederverwendetes Vorkommen 03`,
	bookReaderResult: "Book-Leseergebnis",
	partOne: "Teil I",
	section: "Abschnitt",
	chapterOne: "Kapitel 01",
	chapterTwo: "Kapitel 02",
	postA: `${deTerminology.post.forms.label} A`,
	postB: `${deTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · optionale Graphschicht`,
	entrance: verbatimTerms.entranceNode.value,
	passage: verbatimTerms.passageNode.value,
	ending: verbatimTerms.endingNode.value,
	entry: "Einstieg",
	choiceAB: "Choice A / B",
	terminal: "Endpunkt",
	gamebookReaderResult: "GameBook-Leseergebnis",
	currentPassage: `Aktuelle ${verbatimTerms.passageNode.value}`,
	stableId: `stabile ${verbatimTerms.id.value}`,
	availableChoices: "Verfügbare Auswahlmöglichkeiten",
	choicesCount: "2",
	journeyStep: verbatimTerms.journeyStep.value,
	separate: "separat",
} satisfies typeof import("../../en/components/structure").default;

export default content;
