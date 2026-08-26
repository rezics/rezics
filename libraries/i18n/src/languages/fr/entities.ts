import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = frTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Type",
	verification: "Vérification",
	owner: "Propriétaire",
	verified: "Vérifié",
	unverified: "Non vérifié",
	measurements: "Mensurations",
	height: "Taille",
	weight: "Poids",
	bust: "Tour de poitrine",
	waist: "Tour de taille",
	hips: "Tour de hanches",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `Nouvelle ${entityTerms.inline}`,
	newTag: "Nouveau tag",
	externalLinksDescription: `Pages publiques étayant les informations sur cette ${entityTerms.inline}.`,
	externalLinksEmpty: "Aucun lien externe pour le moment.",
	relatedContentTitle: "Contenus associés",
	relatedContentDescription: `Contenus associés à cette ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "Aucun contenu associé",
	relatedContentEmptyDescription: "Il n’y a pas encore de contenu associé à afficher.",
} satisfies typeof import("../zh-Hant/entities").default;
