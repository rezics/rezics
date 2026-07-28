import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	preview: `¿La interfaz de ${verbatimTerms.api.value} y ${verbatimTerms.oauth.value} es una captura real del producto?`,
	status: "¿Cómo se determina el estado de implementación?",
} satisfies typeof import("../../../../en/products/api-oauth/faq/questions").default;

export default content;
