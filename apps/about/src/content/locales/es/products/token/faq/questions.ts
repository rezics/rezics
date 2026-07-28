import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `¿Cómo debe recibir un agente de ${verbatimTerms.ai.value} un token de ${verbatimTerms.api.value}?`,
	status: `¿Qué cambia ${verbatimTerms.privilegedTokenPolicy.value}?`,
} satisfies typeof import("../../../../en/products/token/faq/questions").default;

export default content;
