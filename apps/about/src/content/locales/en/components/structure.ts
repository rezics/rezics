import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `Valid structure · ${verbatimTerms.dag.value} check passed`,
	structure: "Structure editor",
	treeMode: "Tree mode",
	gameMode: "Game mode",
	path: "Content Structure / Book adapter",
	orderedTree: `${verbatimTerms.contentStructure.value} · ordered tree`,
	bookRoot: "Book root",
	partOccurrence: "Part I · occurrence",
	postAOccurrence: `${enTerminology.post.forms.label} A · occurrence 01`,
	postBOccurrence: `${enTerminology.post.forms.label} B · occurrence 02`,
	reusedOccurrence: `${enTerminology.post.forms.label} A · reused occurrence 03`,
	bookReaderResult: "Book reader result",
	partOne: "Part I",
	section: "section",
	chapterOne: "Chapter 01",
	chapterTwo: "Chapter 02",
	postA: `${enTerminology.post.forms.label} A`,
	postB: `${enTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · optional graph layer`,
	entrance: String(verbatimTerms.entranceNode.value),
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choiceAB: "Choice A / B",
	terminal: String(verbatimTerms.terminalEdge.value),
	gamebookReaderResult: "GameBook reader result",
	currentPassage: `Current ${verbatimTerms.passageNode.value}`,
	stableId: "stable id",
	availableChoices: "Available choices",
	choicesCount: "2",
	journeyStep: String(verbatimTerms.journeyStep.value),
	separate: "separate",
};

export default content;
