import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `Comment fournir un jeton ${verbatimTerms.api.value} à un agent d’${verbatimTerms.ai.value} ?`,
	status: `Que change ${verbatimTerms.privilegedTokenPolicy.value} ?`,
} satisfies typeof import("../../../../en/products/token/faq/questions").default;

export default content;
