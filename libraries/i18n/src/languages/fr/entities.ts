import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: entityTerms } = frTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Type",
	verification: "Vérification",
	owner: "Propriétaire",
	verified: "Vérifié",
	unverified: "Non vérifié",
	newEntity: `Nouvelle ${entityTerms.inline}`,
	newTag: "Nouveau tag",
	sourceLinksDescription: `Pages publiques étayant les informations sur cette ${entityTerms.inline}.`,
	sourceLinksEmpty: "Aucun lien source pour le moment.",
	relatedContentTitle: "Contenus associés",
	relatedContentDescription: `Contenus associés à cette ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "Aucun contenu associé",
	relatedContentEmptyDescription: "Il n’y a pas encore de contenu associé à afficher.",
} satisfies typeof import("../zh-Hant/entities").default;
