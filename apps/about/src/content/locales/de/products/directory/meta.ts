import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value}-Produkte und -Plattform`,
	description: `Alle ${verbatimTerms.rezics.value}-Produkte und geteilten Fähigkeiten.`,
} satisfies typeof import("../../../en/products/directory/meta").default;

export default content;
