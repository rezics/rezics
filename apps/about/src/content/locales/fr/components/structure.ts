import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	validation: `Structure valide · vérification ${verbatimTerms.dag.value} réussie`,
	structure: "Éditeur de structure",
	treeMode: "Mode arborescent",
	gameMode: "Mode jeu",
	path: "Structure de contenu / adaptateur Livre",
	orderedTree: `${verbatimTerms.contentStructure.value} · arborescence ordonnée`,
	bookRoot: "Racine du livre",
	partOccurrence: "Partie I · occurrence",
	postAOccurrence: `${frTerminology.post.forms.label} A · occurrence 01`,
	postBOccurrence: `${frTerminology.post.forms.label} B · occurrence 02`,
	reusedOccurrence: `${frTerminology.post.forms.label} A · occurrence réutilisée 03`,
	bookReaderResult: "Résultat dans le lecteur de livres",
	partOne: "Partie I",
	section: "section",
	chapterOne: "Chapitre 01",
	chapterTwo: "Chapitre 02",
	postA: `${frTerminology.post.forms.label} A`,
	postB: `${frTerminology.post.forms.label} B`,
	optionalGraph: `${verbatimTerms.gameContentStructure.value} · couche de graphe facultative`,
	entrance: String(verbatimTerms.entranceNode.value),
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choiceAB: "Choix A / B",
	terminal: String(verbatimTerms.terminalEdge.value),
	gamebookReaderResult: "Résultat dans le lecteur de livres-jeux",
	currentPassage: `${verbatimTerms.passageNode.value} actuel`,
	stableId: "identifiant stable",
	availableChoices: "Choix disponibles",
	choicesCount: "2",
	journeyStep: String(verbatimTerms.journeyStep.value),
	separate: "séparé",
} satisfies typeof import("../../en/components/structure").default;

export default content;
