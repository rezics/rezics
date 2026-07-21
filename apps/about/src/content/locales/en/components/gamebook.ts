import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "Reader",
	journey: "Current Journey",
	entrance: String(verbatimTerms.entranceNode.value),
	passageTitle: `${verbatimTerms.passageNode.value}: Archive entrance`,
	branchDescription: `The reader reaches a documented branch. The selected path is recorded as ${verbatimTerms.journeyStep.value}, separate from general Progress.`,
	choose: "Make a choice",
	choiceA: "Choice A · Continue to the reading room",
	choiceAOutcome: `${verbatimTerms.passageNode.value}: Reading room`,
	choiceAStep: "Choice A → Reading room",
	choiceB: "Choice B · Leave the archive",
	choiceBOutcome: `${verbatimTerms.endingNode.value}: Return later`,
	choiceBStep: `Choice B → ${verbatimTerms.endingNode.value}`,
	authoring: "Authoring editor",
	validation: `Valid structure · ${verbatimTerms.dag.value} check passed`,
	authoringSequence: `${verbatimTerms.gameContentStructure.value} authoring sequence`,
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choicesTwo: "choices: 2",
	retirable: "retirable",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · no loops, scripts, variables, combat, or runtime rules.`,
};

export default content;
