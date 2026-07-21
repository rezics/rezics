import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `Ist die Ansicht von ${verbatimTerms.api.value} & ${verbatimTerms.oauth.value} ein echter Screenshot?`,
	status: "Wie wird der Implementierungsstatus bestimmt?",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
