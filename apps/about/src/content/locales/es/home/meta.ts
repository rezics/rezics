import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — Identidad, estructura e historial para el contenido`,
	description: `Explora los productos, las capacidades compartidas y la plataforma abierta de ${verbatimTerms.rezics.value}.`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
