import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	reader: "Lecteur",
	journey: "Parcours actuel",
	entrance: String(verbatimTerms.entranceNode.value),
	passageTitle: `${verbatimTerms.passageNode.value} : entrée des archives`,
	branchDescription: `Le lecteur atteint un embranchement documenté. Le chemin choisi est enregistré sous forme de ${verbatimTerms.journeyStep.value}, séparément de la progression générale.`,
	choose: "Faites un choix",
	choiceA: "Choix A · Continuer vers la salle de lecture",
	choiceAOutcome: `${verbatimTerms.passageNode.value} : salle de lecture`,
	choiceAStep: "Choix A → Salle de lecture",
	choiceB: "Choix B · Quitter les archives",
	choiceBOutcome: `${verbatimTerms.endingNode.value} : revenir plus tard`,
	choiceBStep: `Choix B → ${verbatimTerms.endingNode.value}`,
	authoring: "Éditeur de création",
	validation: `Structure valide · vérification ${verbatimTerms.dag.value} réussie`,
	authoringSequence: `Séquence de création ${verbatimTerms.gameContentStructure.value}`,
	passage: String(verbatimTerms.passageNode.value),
	ending: String(verbatimTerms.endingNode.value),
	entry: String(verbatimTerms.entryEdge.value),
	choicesTwo: "choix : 2",
	retirable: "retirable",
	constraints: `${verbatimTerms.entranceNode.value} → ${verbatimTerms.passageNode.value} → ${verbatimTerms.endingNode.value} · aucune boucle, aucun script, aucune variable, aucun combat ni aucune règle d’exécution.`,
} satisfies typeof import("../../en/components/gamebook").default;

export default content;
