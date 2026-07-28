import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: realmTerms } = esTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description:
		"Donde los objetos, las relaciones, las conversaciones y el conocimiento crecen juntos.",
	socialDescription: `Donde las obras, los ${realmTerms.plural} y las conversaciones reflexivas se encuentran.`,
	pwaDescription: `Descubre obras y ${realmTerms.plural}, y participa en conversaciones reflexivas.`,
} satisfies typeof import("../zh-Hant/brand").default;
