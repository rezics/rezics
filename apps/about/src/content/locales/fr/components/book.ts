import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Sections du livre",
	book: "Livre",
	main: "principal",
	identity: "Identité du livre",
	variants: "principal et variantes",
	contents: "Structure des chapitres",
	history: "Historique",
	published: "Publié",
	title: "Titre du livre",
	variantDescription: "principal · variante : édition traduite · Unit / Livre",
	contentStructure: String(verbatimTerms.contentStructure.value),
	gameContentStructure: String(verbatimTerms.gameContentStructure.value),
	chapterOne: "01 · Titre du chapitre",
	chapterTwo: "02 · Titre du chapitre",
	reusedInterlude: "03 · Interlude réutilisé",
	postA: `${frTerminology.post.forms.label} A`,
	postB: `${frTerminology.post.forms.label} B`,
	credits: "Attribution",
	creditAttribution: String(verbatimTerms.creditAttribution.value),
	author: "Auteur",
	translator: "Traducteur",
	publisher: "Éditeur",
	entity: "Fiche d’entité",
} satisfies typeof import("../../en/components/book").default;

export default content;
