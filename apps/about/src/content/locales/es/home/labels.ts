import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	eyebrow: `Sistema de productos de ${verbatimTerms.rezics.value}`,
	title: "El contenido puede conservar su identidad, su estructura y su historial.",
	stageTitle: `Conoce ${verbatimTerms.rezics.value} a través de sus superficies de producto`,
	productsTitle: "Cada producto tiene su propio punto de acceso",
	platformTitle: "Las capacidades compartidas funcionan entre productos",
	formulaTitle: "Cómo las capacidades dan forma a los productos",
	historyTitle: `El Historial es la columna vertebral de la información de ${verbatimTerms.rezics.value}`,
	openTitle: "Abierto desde la documentación hasta el código fuente",
	eyebrows: {
		stage: "Representación del producto",
		products: "Productos",
		platform: "Plataforma",
		composition: "Composición",
		history: "Historial",
		openSource: "Código abierto",
	},
	formulaResults: {
		chapters: "Estructura de capítulos",
		credits: "Relaciones de autores, traductores y editoriales",
		subjects: "Relaciones de personajes, temas y obras derivadas",
	},
} satisfies typeof import("../../en/home/labels").default;

export default content;
