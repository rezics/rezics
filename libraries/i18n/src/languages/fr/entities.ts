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
} satisfies typeof import("../zh-Hant/entities").default;
