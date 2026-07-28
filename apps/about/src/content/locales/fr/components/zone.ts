import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	zone: frTerminology.zone.forms.label,
	blocks: "Configuration des blocs",
	query: "Requête de contenu",
	history: "Historique",
	preview: "Aperçu du produit",
	path: `${frTerminology.zone.forms.label} / configuration`,
	blockSchema: String(verbatimTerms.blockSchema.value),
	headerBlock: "Bloc d’en-tête",
	feedBlock: "Bloc de fil · requête : récent",
	collectionBlock: "Bloc de collection · référence",
	feedResult: "Résultat du fil",
	postCard: `Carte de ${frTerminology.post.forms.inline}`,
	catalogResult: "Résultat du catalogue",
	bookCard: "Carte de livre",
	discussion: "Discussion",
	comment: "Commentaire",
} satisfies typeof import("../../en/components/zone").default;

export default content;
