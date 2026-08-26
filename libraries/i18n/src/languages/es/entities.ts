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
	measurements: "Medidas",
	height: "Estatura",
	weight: "Peso",
	bust: "Busto",
	waist: "Cintura",
	hips: "Cadera",
	centimetreUnit: "cm",
	kilogramUnit: "kg",
	newEntity: `Nueva ${entityTerms.inline}`,
	newTag: "Nuevo tag",
	externalLinksDescription: `Páginas públicas que respaldan la información sobre esta ${entityTerms.inline}.`,
	externalLinksEmpty: "Aún no hay enlaces externos.",
	relatedContentTitle: "Contenido relacionado",
	relatedContentDescription: `Contenido relacionado con esta ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "No hay contenido relacionado",
	relatedContentEmptyDescription: "Todavía no hay contenido relacionado que mostrar.",
} satisfies typeof import("../zh-Hant/entities").default;
