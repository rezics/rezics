import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: entityTerms } = deTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Art",
	verification: "Bestätigung",
	owner: "Eigentümer",
	verified: "Bestätigt",
	unverified: "Nicht bestätigt",
	newEntity: `Neue ${entityTerms.label}`,
	newTag: "Neuer Tag",
} satisfies typeof import("../zh-Hant/entities").default;
