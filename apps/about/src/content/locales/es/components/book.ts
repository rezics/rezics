import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Secciones del libro",
	book: "Libro",
	main: "principal",
	identity: "Identidad del libro",
	variants: "principal y variantes",
	contents: "Estructura de capítulos",
	history: "Historial",
	published: "Publicado",
	title: "Título del libro",
	variantDescription: "principal · variante: edición traducida · Unidad / Libro",
	contentStructure: String(verbatimTerms.contentStructure.value),
	gameContentStructure: String(verbatimTerms.gameContentStructure.value),
	chapterOne: "01 · Título del capítulo",
	chapterTwo: "02 · Título del capítulo",
	reusedInterlude: "03 · Interludio reutilizado",
	postA: `${esTerminology.post.forms.label} A`,
	postB: `${esTerminology.post.forms.label} B`,
	credits: "Atribución",
	creditAttribution: String(verbatimTerms.creditAttribution.value),
	author: "Autor",
	translator: "Traductor",
	publisher: "Editorial",
	entity: "Registro de entidad",
} satisfies typeof import("../../en/components/book").default;

export default content;
