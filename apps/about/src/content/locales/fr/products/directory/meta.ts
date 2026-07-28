import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `Produits et plateforme ${verbatimTerms.rezics.value}`,
	description: `Parcourez chaque produit, déclinaison de produit et capacité partagée de ${verbatimTerms.rezics.value}.`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
