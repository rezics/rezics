import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	zone: esTerminology.zone.forms.label,
	blocks: "Configuración de bloques",
	query: "Consulta de contenido",
	history: "Historial",
	preview: "Vista previa del producto",
	path: `${esTerminology.zone.forms.label} / configuración`,
	blockSchema: String(verbatimTerms.blockSchema.value),
	headerBlock: "Bloque de cabecera",
	feedBlock: "Bloque de flujo · consulta: recientes",
	collectionBlock: "Bloque de colección · referencia",
	feedResult: "Resultado del flujo",
	postCard: `Tarjeta de ${esTerminology.post.forms.label}`,
	catalogResult: "Resultado del catálogo",
	bookCard: "Tarjeta de libro",
	discussion: "Conversación",
	comment: "Comentario",
} satisfies typeof import("../../en/components/zone").default;

export default content;
