import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `Productos y plataforma de ${verbatimTerms.rezics.value}`,
	description: `Explora todos los productos, las manifestaciones de producto y las capacidades compartidas de ${verbatimTerms.rezics.value}.`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
