import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: realmTerms } = frTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "Là où objets, relations, discussions et connaissances se développent ensemble.",
	socialDescription: `Là où les œuvres, les ${realmTerms.plural} et les échanges réfléchis se rencontrent.`,
	pwaDescription: `Découvrez des œuvres et des ${realmTerms.plural}, et participez à des échanges réfléchis.`,
} satisfies typeof import("../zh-Hant/brand").default;
