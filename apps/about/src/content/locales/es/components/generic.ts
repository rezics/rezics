import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	record: "Registro",
	relations: "Relaciones",
	history: "Historial",
	conceptPreview: "Vista previa conceptual",
	description:
		"Una superficie de producto neutral y sustituible. No contiene ilustraciones decorativas ni métricas de uso inventadas.",
	identity: "Identidad",
	stableRecord: "Registro estable",
	unit: "Unidad",
	relatedProducts: "Productos relacionados",
	references: "referencias",
	publishedState: "Estado publicado",
	sharedCapabilities: "Capacidades compartidas",
	attribution: "Atribución",
	entity: "Entidad",
	tags: "Etiquetas",
	queryable: "consultable",
	api: String(verbatimTerms.api.value),
	permissioned: "con permisos",
} satisfies typeof import("../../en/components/generic").default;

export default content;
