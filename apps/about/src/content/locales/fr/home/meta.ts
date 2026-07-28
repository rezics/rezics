import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	title: `${verbatimTerms.rezics.value} — Identité, structure et historique des contenus`,
	description: `Découvrez les produits, les capacités partagées et la plateforme ouverte de ${verbatimTerms.rezics.value}.`,
} satisfies typeof import("../../en/home/meta").default;

export default content;
