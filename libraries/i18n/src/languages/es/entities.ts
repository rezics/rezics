import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: entityTerms } = esTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Tipo",
	verification: "Verificación",
	owner: "Propietario",
	verified: "Verificado",
	unverified: "Sin verificar",
	newEntity: `Nueva ${entityTerms.inline}`,
	newTag: "Nuevo tag",
} satisfies typeof import("../zh-Hant/entities").default;
