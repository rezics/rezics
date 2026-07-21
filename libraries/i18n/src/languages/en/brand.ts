import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "Where objects, relationships, discussion, and knowledge grow together.",
	socialDescription: `Where works, ${realmTerms.pluralLabel}, and thoughtful discussion connect.`,
	pwaDescription: `Discover works, join ${realmTerms.pluralLabel}, and take part in thoughtful discussion.`,
} satisfies typeof import("../zh-Hant/brand").default;
